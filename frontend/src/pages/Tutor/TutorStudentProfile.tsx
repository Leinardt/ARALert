import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { StudentAcademicProfile, Grade, Attendance } from '../../types';
import { getRiskAvatarClass } from '../../utils/analyticsHelpers';
import {
  ArrowLeft,
  GraduationCap,
  Calendar,
  BookOpen,
  AlertTriangle,
  Plus,
  Trash2,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit3,
  X,
  Sparkles,
  User,
  Sliders,
  TrendingUp,
  Layers,
  ShieldAlert,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  Smile,
  Meh,
  Frown,
} from 'lucide-react';

/* ─── Helpers ─────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700',
];
const avatarColor = (name: string) => AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) => {
  const p = (name || '').trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name || '??').slice(0, 2).toUpperCase();
};

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
  switch (level) {
    case 'plus':      return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Plus</span>;
    case 'summer':    return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Summer</span>;
    case 'graduated': return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Graduated</span>;
    default:          return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Basic</span>;
  }
};

const getRiskBadge = (tier?: string | null) => {
  switch (tier?.toLowerCase()) {
    case 'high':   return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">High Risk</span>;
    case 'medium': return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Medium Risk</span>;
    default:       return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Low Risk</span>;
  }
};

/* ─── Main Component ───────────────────────────────────────────── */
export const TutorStudentProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overall' | 'attendance' | 'score'>('overall');

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

  const scoreMood = useMemo(() => {
    const takenGrades = studentGrades.filter(
      (g) => g.remarks?.trim().toLowerCase() !== 'not taken'
    );
    if (takenGrades.length === 0 && (!profile?.grade_details || profile.grade_details.length === 0)) {
      return {
        icon: Meh,
        cardBg: 'bg-amber-50 border-amber-200',
        iconBg: 'bg-amber-100 border-amber-200',
        iconColor: 'text-amber-600',
        textColor: 'text-amber-600',
        valueColor: 'text-amber-500',
        descColor: 'text-amber-500',
      };
    }
    if (calculatedAvgScore >= 81) {
      return {
        icon: Smile,
        cardBg: 'bg-emerald-50 border-emerald-200',
        iconBg: 'bg-emerald-100 border-emerald-200',
        iconColor: 'text-emerald-600',
        textColor: 'text-emerald-600',
        valueColor: 'text-emerald-600',
        descColor: 'text-emerald-500',
      };
    }
    if (calculatedAvgScore >= 75) {
      return {
        icon: Meh,
        cardBg: 'bg-amber-50 border-amber-200',
        iconBg: 'bg-amber-100 border-amber-200',
        iconColor: 'text-amber-600',
        textColor: 'text-amber-600',
        valueColor: 'text-amber-500',
        descColor: 'text-amber-500',
      };
    }
    return {
      icon: Frown,
      cardBg: 'bg-rose-50 border-rose-200',
      iconBg: 'bg-rose-100 border-rose-200',
      iconColor: 'text-rose-600',
      textColor: 'text-rose-600',
      valueColor: 'text-rose-500',
      descColor: 'text-rose-500',
    };
  }, [calculatedAvgScore, studentGrades, profile]);

  const attendanceMood = useMemo(() => {
    const totalLogs = profile ? (profile.attendance.present + profile.attendance.late + profile.attendance.absent) : 0;
    if (totalLogs === 0) {
      return {
        icon: Meh,
        cardBg: 'bg-amber-50 border-amber-200',
        iconBg: 'bg-amber-100 border-amber-200',
        iconColor: 'text-amber-600',
        textColor: 'text-amber-600',
        valueColor: 'text-amber-500',
        descColor: 'text-amber-500',
      };
    }
    if (attendanceRate >= 81) {
      return {
        icon: Smile,
        cardBg: 'bg-emerald-50 border-emerald-200',
        iconBg: 'bg-emerald-100 border-emerald-200',
        iconColor: 'text-emerald-600',
        textColor: 'text-emerald-600',
        valueColor: 'text-emerald-600',
        descColor: 'text-emerald-500',
      };
    }
    if (attendanceRate >= 75) {
      return {
        icon: Meh,
        cardBg: 'bg-amber-50 border-amber-200',
        iconBg: 'bg-amber-100 border-amber-200',
        iconColor: 'text-amber-600',
        textColor: 'text-amber-600',
        valueColor: 'text-amber-500',
        descColor: 'text-amber-500',
      };
    }
    return {
      icon: Frown,
      cardBg: 'bg-rose-50 border-rose-200',
      iconBg: 'bg-rose-100 border-rose-200',
      iconColor: 'text-rose-600',
      textColor: 'text-rose-600',
      valueColor: 'text-rose-500',
      descColor: 'text-rose-500',
    };
  }, [attendanceRate, profile]);

  // Modals state
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Form states
  const [gradeForm, setGradeForm] = useState({
    subject: '',
    quarter: 1,
    score: '',
    component_type: 'assessment' as 'assessment' | 'weekly_task' | 'attendance',
    remarks: ''
  });

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
    status: 'present' as 'present' | 'late' | 'absent',
    aral_activity_id: ''
  });

  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    lrn: '',
    aral_level: 'basic'
  });
  const [isEvaluatingLevel, setIsEvaluatingLevel] = useState(false);
  const [levelEvalMessage, setLevelEvalMessage] = useState<string | null>(null);
  const [studentEditError, setStudentEditError] = useState<string | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);

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
      const [data, gradesData] = await Promise.all([
        academicService.getStudentProfile(id),
        academicService.getGrades({ student_id: id }).catch(() => [] as Grade[]),
      ]);
      setProfile(data);
      setStudentGrades(gradesData);
      setStudentForm({
        first_name: data.student.first_name,
        last_name: data.student.last_name,
        username: data.student.username,
        email: data.student.email,
        lrn: data.student.lrn || '',
        aral_level: data.student.aral_level || 'basic'
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

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !gradeForm.subject || !gradeForm.score) return;
    try {
      await academicService.createGrade({
        student: id,
        subject: gradeForm.subject,
        quarter: Number(gradeForm.quarter),
        score: Number(gradeForm.score),
        component_type: gradeForm.component_type,
        remarks: gradeForm.remarks || null
      });
      setShowGradeModal(false);
      setGradeForm({ subject: '', quarter: 1, score: '', component_type: 'assessment', remarks: '' });
      fetchProfile();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add grade.');
    }
  };

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
    } catch (err) {
      alert('Failed to log risk alert.');
    }
  };

  const handleResolveRisk = async (riskId: number) => {
    try {
      await academicService.updateAcademicRisk(riskId, { resolved: true });
      fetchProfile();
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
    } catch (err) {
      alert('Failed to log attendance.');
    }
  };

  const handleSaveStudentDetails = async () => {
    if (!profile) return;
    setIsSavingStudent(true);
    setStudentEditError(null);

    try {
      await userService.updateUser(profile.student.id, {
        first_name: studentForm.first_name,
        last_name: studentForm.last_name,
        username: studentForm.username,
        email: studentForm.email,
        lrn: studentForm.lrn || null,
        aral_level: studentForm.aral_level
      });
      setIsEditingStudent(false);
      await fetchProfile();
    } catch (err: any) {
      setStudentEditError(err?.response?.data?.detail || 'Failed to save student details.');
    } finally {
      setIsSavingStudent(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Back button skeleton */}
        <div className="h-5 w-44 rounded bg-gray-200" />
        {/* Header card skeleton */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-200 shrink-0" />
            <div className="space-y-2.5 flex-1">
              <div className="h-6 w-48 rounded bg-gray-200" />
              <div className="h-3.5 w-32 rounded bg-gray-100" />
            </div>
          </div>
        </div>
        {/* Tab nav skeleton */}
        <div className="flex w-full rounded-2xl bg-gray-100 p-1 gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-9 rounded-xl bg-gray-200" />
          ))}
        </div>
        {/* KPI containers skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-gray-200 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-2.5 w-24 rounded bg-gray-200" />
                <div className="h-7 w-16 rounded bg-gray-200" />
                <div className="h-2.5 w-36 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
        {/* Table card skeleton */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="space-y-1.5">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-28 rounded-xl bg-gray-200" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-1">
              <div className="h-4 w-28 rounded bg-gray-200" />
              <div className="h-4 w-16 rounded bg-gray-100" />
              <div className="h-4 w-20 rounded bg-gray-100" />
              <div className="h-4 flex-1 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 p-5 rounded-2xl">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load profile</p>
          <p className="text-xs text-red-700 mt-0.5">{error || 'Profile not found.'}</p>
          <Link to="/tutor/students" className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-[var(--brand)] hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Assigned Students
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── Top Navigation & Actions ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to="/tutor/students"
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assigned Students
        </Link>
      </div>

      {/* ── Student Header Card ──────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-extrabold shadow-sm shrink-0 ${getRiskAvatarClass(riskTier)}`}>
              {getInitials(profile.student.name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{profile.student.name}</h1>
              <p className="text-xs text-gray-500 font-medium mt-1">
                LRN: <span className="font-mono font-bold text-gray-700">{profile.student.lrn || 'N/A'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────────────── */}
      <div className="flex w-full rounded-2xl bg-gray-100 p-1" role="tablist" aria-label="Student profile view">
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
              className={`flex-1 rounded-xl py-2.5 px-3 text-xs font-bold uppercase flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
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
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">ARAL LEVEL</p>
                  <p className="text-2xl font-extrabold text-gray-900 mt-0.5 capitalize">
                    {profile.student.aral_level || 'Basic'}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">COMPOSITE SCORE</p>
                  <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                    {smartPct(compositeScore)}%
                  </p>
                </div>
              </div>

              <div className={`rounded-3xl border p-5 shadow-sm flex items-center gap-4 ${
                riskTier === 'High'
                  ? 'bg-rose-50 border-rose-200'
                  : riskTier === 'Medium'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                  riskTier === 'High'
                    ? 'bg-rose-100 border-rose-200 text-rose-600'
                    : riskTier === 'Medium'
                    ? 'bg-amber-100 border-amber-200 text-amber-600'
                    : 'bg-emerald-100 border-emerald-200 text-emerald-600'
                }`}>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${
                    riskTier === 'High'
                      ? 'text-rose-600'
                      : riskTier === 'Medium'
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}>RISK LEVEL</p>
                  <p className={`text-2xl font-extrabold mt-0.5 ${
                    riskTier === 'High'
                      ? 'text-rose-900'
                      : riskTier === 'Medium'
                      ? 'text-amber-900'
                      : 'text-emerald-900'
                  }`}>
                    {riskTier}
                  </p>
                </div>
              </div>
            </div>

            {/* Performance Summary Table */}
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h3 className="text-base font-bold text-gray-900 uppercase">STUDENT PERFORMANCE SUMMARY</h3>
                <p className="mt-0.5 text-xs font-medium text-gray-500">Overview of the calculation</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm font-normal" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
                  <thead className="bg-gray-50">
                    <tr className="divide-x divide-gray-100 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-6 py-3.5 text-center">AVERAGE ATTENDANCE RATE</th>
                      <th className="px-6 py-3.5 text-center">AVERAGE SCORE</th>
                      <th className="px-6 py-3.5 text-center">COMPOSITE SCORE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    <tr className="divide-x divide-gray-100 transition-colors hover:bg-gray-50/80 text-center">
                      <td className="px-6 py-4 font-normal text-emerald-600">
                        {smartPct(attendanceRate)}%
                      </td>
                      <td className="px-6 py-4 font-normal text-gray-700">
                        {smartPct(scoreAvg)}%
                      </td>
                      <td className="px-6 py-4 font-normal text-indigo-600">
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
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-emerald-600" strokeWidth={3} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">TOTAL PRESENT</p>
                  <p className="text-2xl font-extrabold text-emerald-900 mt-0.5">{profile.attendance.present}</p>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">Student's total present records</p>
                </div>
              </div>
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                  <X className="w-5 h-5 text-rose-600" strokeWidth={3} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">TOTAL ABSENT</p>
                  <p className="text-2xl font-extrabold text-rose-900 mt-0.5">{profile.attendance.absent}</p>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">Student's total absent records</p>
                </div>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${attendanceMood.iconBg}`}>
                  <attendanceMood.icon className={`w-5 h-5 ${attendanceMood.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">AVERAGE ATTENDANCE RATE</p>
                  <p className={`text-2xl font-extrabold mt-0.5 ${attendanceMood.valueColor}`}>{smartPct(attendanceRate)}%</p>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">Student's average attendance rate</p>
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
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-emerald-600" strokeWidth={3} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">TOTAL PASSED</p>
                  <p className="text-2xl font-extrabold text-emerald-900 mt-0.5">{passedCount}</p>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">Student's total passed score records</p>
                </div>
              </div>
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                  <X className="w-5 h-5 text-rose-600" strokeWidth={3} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">TOTAL FAILED</p>
                  <p className="text-2xl font-extrabold text-rose-900 mt-0.5">{failedCount}</p>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">Student's total failed score records</p>
                </div>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm flex items-center gap-4 dark:border-[#1A1A1A] dark:bg-[#0A0A0A]">
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${scoreMood.iconBg}`}>
                  <scoreMood.icon className={`w-5 h-5 ${scoreMood.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-slate-100">AVERAGE SCORE</p>
                  <p className={`text-2xl font-extrabold mt-0.5 ${scoreMood.valueColor}`}>{smartPct(calculatedAvgScore)}%</p>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">Student's average score</p>
                </div>
              </div>
            </div>

            {/* Student Score History */}
            <ScoreHistoryList
              studentId={id!}
              reloadTrigger={profile}
              onGradesLoaded={(loadedGrades) => setStudentGrades(loadedGrades)}
              onLogNewGrade={() => setShowGradeModal(true)}
            />
          </div>
        )}
      </div>

      {/* ── GRADE MODAL ────────────────────────────────────────────── */}
      {showGradeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddGrade} className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Log Academic Grade</h3>
              <button type="button" onClick={() => setShowGradeModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mathematics"
                  value={gradeForm.subject}
                  onChange={(e) => setGradeForm({ ...gradeForm, subject: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Quarter</label>
                <select
                  value={gradeForm.quarter}
                  onChange={(e) => setGradeForm({ ...gradeForm, quarter: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
                >
                  <option value={1}>1st Quarter</option>
                  <option value={2}>2nd Quarter</option>
                  <option value={3}>3rd Quarter</option>
                  <option value={4}>4th Quarter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Score (0-100)</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  step={0.01}
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Component Type</label>
                <select
                  value={gradeForm.component_type}
                  onChange={(e) => setGradeForm({ ...gradeForm, component_type: e.target.value as any })}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
                >
                  <option value="assessment">Assessment</option>
                  <option value="weekly_task">Weekly Task</option>
                  <option value="attendance">Attendance</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Remarks (Optional)</label>
              <textarea
                value={gradeForm.remarks}
                onChange={(e) => setGradeForm({ ...gradeForm, remarks: e.target.value })}
                placeholder="Optional notes regarding this score..."
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] h-20 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowGradeModal(false)}
                className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-2xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-2xl text-xs font-bold cursor-pointer shadow-sm transition-all"
              >
                Save Grade
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── ARAL ACTIVITY MODAL ────────────────────────────────────── */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddActivity} className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Create ARAL Activity</h3>
              <button type="button" onClick={() => setShowActivityModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Remedial Reading Practice"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
              <textarea
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                placeholder="Describe the activity guidelines or intervention objectives..."
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] h-20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Initial Status</label>
              <select
                value={activityForm.status}
                onChange={(e) => setActivityForm({ ...activityForm, status: e.target.value as any })}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Remarks (Optional)</label>
              <input
                type="text"
                value={activityForm.remarks}
                onChange={(e) => setActivityForm({ ...activityForm, remarks: e.target.value })}
                placeholder="Additional notes or observation..."
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-2xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-2xl text-xs font-bold cursor-pointer shadow-sm transition-all"
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
          <form onSubmit={handleAddRisk} className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Log Academic Risk Warning</h3>
              <button type="button" onClick={() => setShowRiskModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Risk Level</label>
              <select
                value={riskForm.risk_level}
                onChange={(e) => setRiskForm({ ...riskForm, risk_level: e.target.value as any })}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
              >
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Details & Reasons</label>
              <textarea
                required
                placeholder="Explain why this student is flagged (e.g. failing exam grades, consistent absenteeism)..."
                value={riskForm.details}
                onChange={(e) => setRiskForm({ ...riskForm, details: e.target.value })}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] h-24 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowRiskModal(false)}
                className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-2xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-2xl text-xs font-bold cursor-pointer shadow-sm transition-all"
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
          <form onSubmit={handleAddAttendance} className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-lg">Log Manual Attendance</h3>
              <button type="button" onClick={() => setShowAttendanceModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
              <select
                value={attendanceForm.status}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as any })}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Linked Intervention Activity (Optional)</label>
              <select
                value={attendanceForm.aral_activity_id}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, aral_activity_id: e.target.value })}
                className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)]"
              >
                <option value="">None</option>
                {profile.aral_progress.activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-2xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-5 py-2 rounded-2xl text-xs font-bold cursor-pointer shadow-sm transition-all"
              >
                Log Entry
              </button>
            </div>
          </form>
        </div>
      )}
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
      className={`${className || 'absolute right-0 top-full mt-2'} z-[60] w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl font-sans select-none text-slate-800 animate-in fade-in zoom-in-95 duration-150`}
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif", ...style }}
    >
      {/* Month & Navigation in Poppins */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
          aria-label="Previous Month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-bold text-xs text-slate-900 tracking-wide">{monthName}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
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
              className={`relative flex flex-col items-center justify-center h-7 w-7 mx-auto rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[var(--brand)] text-white font-bold shadow-sm'
                  : isToday
                  ? 'border border-[var(--brand)] text-[var(--brand)] font-bold hover:bg-[var(--brand-light)]'
                  : hasLogs
                  ? 'bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200'
                  : 'text-slate-600 hover:bg-slate-100'
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
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-semibold">
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
  onLogNewGrade?: () => void;
}

const ScoreHistoryList: React.FC<ScoreProps> = ({ studentId, reloadTrigger, onGradesLoaded, onLogNewGrade }) => {
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
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`;
  };

  // Group by month key "YYYY-MM"
  const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);
  const monthLabel = (key: string) => {
    const d = new Date(key + '-01T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  // Build grouped structure for weekly / monthly views
  type Group = { key: string; label: string; records: typeof sortedHistory };
  const groupedHistory = useMemo((): Group[] => {
    if (jumpFiltered !== null) return [];
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of sortedHistory) {
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
  }, [sortedHistory, viewMode, jumpFiltered]);

  const timeGroupedHistory = useMemo((): Group[] => {
    const source = jumpFiltered ?? sortedHistory;
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of source) {
      const timeStr = log.created_at ? formatTimeString(log.created_at) : '—';
      const key = `${log.date_logged}|${timeStr}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries()).map(([key, records]) => {
      const [date, time] = key.split('|');
      return {
        key,
        label: time !== '—' ? `${formatDateString(date)} | ${time}` : formatDateString(date),
        records,
      };
    });
  }, [sortedHistory, jumpFiltered]);

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
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
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
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                      isNotTaken
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
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                      isNotTaken
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
        className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Student Score History</h3>
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
        className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Student Score History</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">0 RECORDS</p>
          </div>
          {onLogNewGrade && (
            <button
              onClick={onLogNewGrade}
              className="inline-flex items-center gap-1.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Grade</span>
            </button>
          )}
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
      className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4 relative"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-gray-900 text-base">STUDENT SCORE HISTORY</h3>
          <p className="mt-0.5 text-xs font-medium text-gray-500">
            {jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length} Record
            {(jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle styled like QR Attendance */}
          <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                id={`student-score-view-${mode}`}
                type="button"
                onClick={() => {
                  setViewMode(mode);
                  setJumpDate(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  viewMode === mode && !jumpDate
                    ? 'bg-[var(--brand)] text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Custom Calendar Dropdown Button in Poppins */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              id="student-score-calendar-btn"
              onClick={() => setShowCalendarPopover((prev) => !prev)}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                jumpDate
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
              title="Select a specific date from calendar"
              aria-label="Open Calendar"
            >
              <Calendar className="w-4 h-4" />
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

          {onLogNewGrade && (
            <button
              onClick={onLogNewGrade}
              className="inline-flex items-center gap-1.5 bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Grade</span>
            </button>
          )}
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
            {timeGroupedHistory.map((group) => (
              <div key={group.key}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
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
          {timeGroupedHistory.map((group) => (
            <div key={group.key}>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
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
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`;
  };

  // Group by month key "YYYY-MM"
  const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);
  const monthLabel = (key: string) => {
    const d = new Date(key + '-01T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  // Build grouped structure for weekly / monthly views
  type Group = { key: string; label: string; records: typeof sortedHistory };
  const groupedHistory = useMemo((): Group[] => {
    if (jumpFiltered !== null) return [];
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of sortedHistory) {
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
  }, [sortedHistory, viewMode, jumpFiltered]);

  const timeGroupedHistory = useMemo((): Group[] => {
    const source = jumpFiltered ?? sortedHistory;
    const grouped = new Map<string, typeof sortedHistory>();
    for (const log of source) {
      const key = `${log.date}|${formatTimeString(log.time_in)}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }
    return Array.from(grouped.entries()).map(([key, records]) => {
      const [date, time] = key.split('|');
      return {
        key,
        label: `${formatDateString(date)} | ${time}`,
        records,
      };
    });
  }, [sortedHistory, jumpFiltered]);

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
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
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
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                    log.status === 'present'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : log.status === 'late'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
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
        className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">STUDENT ATTENDANCE HISTORY</h3>
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
        className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4"
        style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Student Attendance History</h3>
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
      className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4 relative"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-gray-900 text-base">STUDENT ATTENDANCE HISTORY</h3>
          <p className="mt-0.5 text-xs font-medium text-gray-500">
            {jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length} Record
            {(jumpFiltered !== null ? jumpFiltered.length : sortedHistory.length) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle styled like QR Attendance */}
          <div className="flex bg-gray-100 dark:bg-[#111111] rounded-xl p-0.5 gap-0.5">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                id={`student-att-view-${mode}`}
                type="button"
                onClick={() => {
                  setViewMode(mode);
                  setJumpDate(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  viewMode === mode && !jumpDate
                    ? 'bg-[var(--brand)] text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Custom Calendar Dropdown Button in Poppins */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              id="student-attendance-calendar-btn"
              onClick={() => setShowCalendarPopover((prev) => !prev)}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                jumpDate
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-sm'
                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
              title="Select a specific date from calendar"
              aria-label="Open Calendar"
            >
              <Calendar className="w-4 h-4" />
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
            {timeGroupedHistory.map((group) => (
              <div key={group.key}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
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
          {timeGroupedHistory.map((group) => (
            <div key={group.key}>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-gray-100" />
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
