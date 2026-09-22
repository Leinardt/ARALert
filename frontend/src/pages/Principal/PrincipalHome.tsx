import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance, PrincipalDashboardResponse, PrincipalDashboardTrendPoint } from '../../types';
import {
  RefreshCw,
  Download,
  Users,
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Filter,
} from 'lucide-react';
import { ExportDtrModal } from '../../components/ExportDtrModal';

export const PrincipalHome: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<PrincipalDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardDays, setDashboardDays] = useState<number>(7);
  const [selectedTutorId, setSelectedTutorId] = useState<string>('all');
  const [staffAttendance, setStaffAttendance] = useState<Attendance[]>([]);
  const [isDtrExportOpen, setIsDtrExportOpen] = useState(false);
  const [isLoadingDtr, setIsLoadingDtr] = useState(false);

  const openDtrExport = async () => {
    setIsLoadingDtr(true);
    try {
      const records = await academicService.getAttendanceHistory();
      setStaffAttendance(records.filter((record) => ['tutor', 'faculty'].includes(record.role)));
      setIsDtrExportOpen(true);
    } catch (err) {
      console.error('Failed to load staff attendance for DTR export.', err);
      setDashboardError('Failed to load tutor and faculty attendance for the DTR export.');
    } finally {
      setIsLoadingDtr(false);
    }
  };

  const fetchDashboardData = async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await academicService.getPrincipalDashboard({ days: dashboardDays });
      setDashboardData(data);
    } catch (err) {
      console.error(err);
      setDashboardError('Failed to load principal dashboard analytics.');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dashboardDays]);

  const classTrend = selectedTutorId !== 'all'
    ? (dashboardData?.per_tutor_performance?.find((t) => t.tutor_id === selectedTutorId)?.trend ?? [])
    : (dashboardData?.class_performance_trend ?? []);
  const staffTrend = dashboardData?.staff_attendance_trend ?? [];

  const hasClassTrendData = classTrend.some(
    (point) => point.attendance_rate > 0 || point.average_score > 0
  );
  const hasStaffTrendData = staffTrend.some(
    (point) => point.tutor_attendance_rate > 0 || point.faculty_attendance_rate > 0
  );
  const selectedTutorName = selectedTutorId !== 'all'
    ? dashboardData?.per_tutor_performance?.find((t) => t.tutor_id === selectedTutorId)?.tutor_name
    : null;

  // Student and risk metrics
  const totalStudents = dashboardData?.program_summary.total_students || 0;
  const lowRiskCount = dashboardData?.risk_summary.low || 0;
  const medRiskCount = dashboardData?.risk_summary.medium || 0;
  const highRiskCount = dashboardData?.risk_summary.high || 0;

  const lowRiskPct = totalStudents > 0 ? Math.round((lowRiskCount / totalStudents) * 100) : 0;
  const medRiskPct = totalStudents > 0 ? Math.round((medRiskCount / totalStudents) * 100) : 0;
  const highRiskPct = totalStudents > 0 ? Math.round((highRiskCount / totalStudents) * 100) : 0;

  // Aggregate averages across class trend
  const validScorePoints = classTrend.filter((p) => (p.average_score || 0) > 0);
  const avgClassScore = validScorePoints.length > 0
    ? Math.round(validScorePoints.reduce((acc, p) => acc + p.average_score, 0) / validScorePoints.length)
    : 0;

  const validAttPoints = classTrend.filter((p) => (p.attendance_rate || 0) > 0);
  const avgClassAtt = validAttPoints.length > 0
    ? Math.round(validAttPoints.reduce((acc, p) => acc + p.attendance_rate, 0) / validAttPoints.length)
    : 0;

  // Per-tutor aggregated metrics
  const tutorCohortStats = useMemo(() => {
    return (dashboardData?.per_tutor_performance || []).map((tutor) => {
      const scores = tutor.trend.filter((t) => (t.average_score || 0) > 0);
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((acc, t) => acc + t.average_score, 0) / scores.length)
        : 0;
      const atts = tutor.trend.filter((t) => (t.attendance_rate || 0) > 0);
      const avgAtt = atts.length > 0
        ? Math.round(atts.reduce((acc, t) => acc + t.attendance_rate, 0) / atts.length)
        : 0;
      return {
        tutor_id: tutor.tutor_id,
        tutor_name: tutor.tutor_name,
        sessionDays: tutor.trend.length,
        avgScore,
        avgAtt,
        status: avgScore >= 75 ? 'On Track' : avgScore > 0 ? 'Needs Support' : 'Active',
      };
    });
  }, [dashboardData]);

  const chartHeight = 180;
  const chartPadding = 36;
  const classChartWidth = Math.max(320, classTrend.length * 50);
  const staffChartWidth = Math.max(320, staffTrend.length * 50);
  const classStepX = classTrend.length > 1 ? (classChartWidth - chartPadding * 2) / (classTrend.length - 1) : 0;
  const staffStepX = staffTrend.length > 1 ? (staffChartWidth - chartPadding * 2) / (staffTrend.length - 1) : 0;

  const compositeFromPrincipalPoint = (point: PrincipalDashboardTrendPoint) =>
    Math.round(((point.attendance_rate || 0) + (point.average_score || 0)) / 2);

  const buildCompositePoints = (points: PrincipalDashboardTrendPoint[], stepX: number) => {
    if (!points.length) return '';
    return points
      .map((point, index) => {
        const x = chartPadding + index * stepX;
        const compositeValue = compositeFromPrincipalPoint(point);
        const y = chartHeight - chartPadding - ((compositeValue / 100) * (chartHeight - chartPadding * 1.5));
        return `${x},${y}`;
      })
      .join(' ');
  };

  const buildRatePoints = (field: 'tutor' | 'faculty', stepX: number) => {
    if (!staffTrend.length) return '';
    return staffTrend
      .map((point, index) => {
        const x = chartPadding + index * stepX;
        const value = field === 'tutor' ? point.tutor_attendance_rate : point.faculty_attendance_rate;
        const y = chartHeight - chartPadding - ((value / 100) * (chartHeight - chartPadding * 1.5));
        return `${x},${y}`;
      })
      .join(' ');
  };

  const formatDateLabel = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return dateString;
    }
  };

  const statCards = [
    {
      label: 'Tutors',
      value: dashboardData?.program_summary.total_tutors ?? '—',
      subtext: 'Assigned mentors',
      icon: Users,
      color: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Faculty',
      value: dashboardData?.program_summary.total_faculty ?? '—',
      subtext: 'Teaching staff',
      icon: BookOpen,
      color: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Students',
      value: totalStudents > 0 ? totalStudents : '—',
      subtext: 'Enrolled learners',
      icon: GraduationCap,
      color: 'text-sky-600 dark:text-sky-400',
    },
    {
      label: 'Avg Score',
      value: avgClassScore > 0 ? `${avgClassScore}%` : '—',
      subtext: 'Class evaluation',
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Attendance Rate',
      value: avgClassAtt > 0 ? `${avgClassAtt}%` : '—',
      subtext: 'Session check-ins',
      icon: CheckCircle2,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'High Risk',
      value: highRiskCount,
      subtext: `${highRiskPct}% of students`,
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-white dark:bg-[#0c111c] p-4 rounded-md border border-gray-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            Academic Oversight
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">
            Welcome, Principal {user?.last_name}!
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400 font-normal">
            Comprehensive student performance, risk distribution, and tutor analytics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center shrink-0 w-full sm:w-auto">
          <select
            value={dashboardDays}
            onChange={(e) => setDashboardDays(Number(e.target.value))}
            className="flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-md text-xs font-medium bg-white dark:bg-[#0c111c] text-gray-700 dark:text-slate-200"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="inline-flex items-center justify-center bg-[var(--brand-light)] text-[var(--brand-text)] hover:bg-[var(--surface-muted)] px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--brand-border)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openDtrExport}
            disabled={isLoadingDtr}
            className="inline-flex items-center justify-center bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
            {isLoadingDtr ? 'Loading…' : 'Export DTR'}
          </button>
        </div>
      </div>

      {/* ── Key Metrics Cards (6-column) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        {statCards.map((card) => {
          const IconComp = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white dark:bg-[#0c111c] p-2.5 sm:p-3.5 rounded-md border border-gray-200 dark:border-slate-800 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <IconComp className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-1.5">
                {card.value}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                {card.subtext}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Student Distribution & Academic Risk Section ── */}
      <div className="bg-white dark:bg-[#0c111c] p-4 rounded-md border border-gray-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800/80">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Students Analytics
            </p>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
              Academic Risk Distribution
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Total Enrolled: <strong className="font-semibold text-slate-800 dark:text-slate-200">{totalStudents}</strong>
          </span>
        </div>

        {/* Progress Bar Distribution Indicator */}
        <div className="mt-4">
          <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex gap-0.5">
            <div
              style={{ width: `${lowRiskPct}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Low Risk: ${lowRiskCount} (${lowRiskPct}%)`}
            />
            <div
              style={{ width: `${medRiskPct}%` }}
              className="bg-amber-500 transition-all duration-300"
              title={`Medium Risk: ${medRiskCount} (${medRiskPct}%)`}
            />
            <div
              style={{ width: `${highRiskPct}%` }}
              className="bg-rose-500 transition-all duration-300"
              title={`High Risk: ${highRiskCount} (${highRiskPct}%)`}
            />
          </div>

          {/* Risk Level Metrics Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3.5">
            <div className="rounded-md border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/40 dark:bg-emerald-950/10 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Low Risk</span>
              </div>
              <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                {lowRiskCount} <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">({lowRiskPct}%)</span>
              </span>
            </div>

            <div className="rounded-md border border-amber-100 dark:border-amber-950/40 bg-amber-50/40 dark:bg-amber-950/10 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Medium Risk</span>
              </div>
              <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                {medRiskCount} <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400">({medRiskPct}%)</span>
              </span>
            </div>

            <div className="rounded-md border border-rose-100 dark:border-rose-950/40 bg-rose-50/40 dark:bg-rose-950/10 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-xs font-medium text-rose-800 dark:text-rose-300">High Risk</span>
              </div>
              <span className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                {highRiskCount} <span className="text-[11px] font-normal text-rose-600 dark:text-rose-400">({highRiskPct}%)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Student Performance & Staff Attendance Charts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Composite Performance Chart */}
        <div className="bg-white dark:bg-[#0c111c] rounded-md border border-gray-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Student Performance Analytics
              </p>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                {selectedTutorId !== 'all' ? `${selectedTutorName}'s Cohort Trend` : 'Overall Program Composite Trend'}
              </h3>
            </div>
            <select
              value={selectedTutorId}
              onChange={(e) => setSelectedTutorId(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 dark:border-slate-700 rounded-md text-xs font-medium bg-white dark:bg-[#0c111c] text-gray-700 dark:text-slate-200"
            >
              <option value="all">All Tutors</option>
              {dashboardData?.per_tutor_performance && dashboardData.per_tutor_performance.length > 0 ? (
                dashboardData.per_tutor_performance.map((tutor) => (
                  <option key={tutor.tutor_id} value={tutor.tutor_id}>
                    {tutor.tutor_name}
                  </option>
                ))
              ) : null}
            </select>
          </div>

          {dashboardLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : dashboardError ? (
            <div className="rounded-md border border-red-100 bg-red-50 p-3 text-xs text-red-700">{dashboardError}</div>
          ) : hasClassTrendData ? (
            <div className="overflow-x-auto dashboard-chart">
              <svg width={classChartWidth} height={chartHeight} className="block mx-auto">
                {[0, 1, 2, 3, 4].map((line) => {
                  const y = chartPadding + ((chartHeight - chartPadding * 1.5) / 4) * line;
                  return <line key={line} x1={chartPadding} y1={y} x2={classChartWidth - chartPadding} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
                })}
                <polyline fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={buildCompositePoints(classTrend, classStepX)} />
                {classTrend.map((point, index) => {
                  const x = chartPadding + index * classStepX;
                  const compositeValue = compositeFromPrincipalPoint(point);
                  const compositeY = chartHeight - chartPadding - ((compositeValue / 100) * (chartHeight - chartPadding * 1.5));
                  return (
                    <g key={point.date}>
                      <circle cx={x} cy={compositeY} r="3.5" fill="var(--brand)" />
                    </g>
                  );
                })}
                {classTrend.map((point, index) => {
                  const x = chartPadding + index * classStepX;
                  return (
                    <text key={point.date} x={x} y={chartHeight - chartPadding / 2.5} textAnchor="middle" fontSize="9" fill="#6B7280">
                      {formatDateLabel(point.date)}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 p-6 text-center text-xs text-gray-500 dark:text-slate-400">
              No class performance data available for this window.
            </div>
          )}
        </div>

        {/* Staff Attendance Chart */}
        <div className="bg-white dark:bg-[#0c111c] rounded-md border border-gray-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Staff Activity Analytics
              </p>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
                Tutor &amp; Faculty Attendance
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--brand)]"></span>Tutors</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Faculty</span>
            </div>
          </div>

          {dashboardLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="w-7 h-7 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : dashboardError ? (
            <div className="rounded-md border border-red-100 bg-red-50 p-3 text-xs text-red-700">{dashboardError}</div>
          ) : hasStaffTrendData ? (
            <div className="overflow-x-auto dashboard-chart">
              <svg width={staffChartWidth} height={chartHeight} className="block mx-auto">
                {[0, 1, 2, 3, 4].map((line) => {
                  const y = chartPadding + ((chartHeight - chartPadding * 1.5) / 4) * line;
                  return <line key={line} x1={chartPadding} y1={y} x2={staffChartWidth - chartPadding} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
                })}
                <polyline fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={buildRatePoints('tutor', staffStepX)} />
                <polyline fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={buildRatePoints('faculty', staffStepX)} />
                {staffTrend.map((point, index) => {
                  const x = chartPadding + index * staffStepX;
                  const tutorY = chartHeight - chartPadding - ((point.tutor_attendance_rate / 100) * (chartHeight - chartPadding * 1.5));
                  const facultyY = chartHeight - chartPadding - ((point.faculty_attendance_rate / 100) * (chartHeight - chartPadding * 1.5));
                  return (
                    <g key={point.date}>
                      <circle cx={x} cy={tutorY} r="3.5" fill="var(--brand)" />
                      <circle cx={x} cy={facultyY} r="3.5" fill="#10B981" />
                    </g>
                  );
                })}
                {staffTrend.map((point, index) => {
                  const x = chartPadding + index * staffStepX;
                  return (
                    <text key={point.date} x={x} y={chartHeight - chartPadding / 2.5} textAnchor="middle" fontSize="9" fill="#6B7280">
                      {formatDateLabel(point.date)}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30 p-6 text-center text-xs text-gray-500 dark:text-slate-400">
              No staff attendance data available for this window.
            </div>
          )}
        </div>
      </div>

      {/* ── Tutor Performance & Distribution Section ── */}
      <div className="bg-white dark:bg-[#0c111c] rounded-md border border-gray-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800/80">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tutor Analytics &amp; Distribution
            </p>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">
              Tutor Cohort Performance Overview
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {tutorCohortStats.length} Tutors Active
          </span>
        </div>

        {tutorCohortStats.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No tutor performance records found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">Tutor Name</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Tracked Days</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Cohort Avg Score</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Cohort Attendance</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/70">
                {tutorCohortStats.map((tutor) => (
                  <tr
                    key={tutor.tutor_id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {tutor.tutor_name}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono">
                      {tutor.sessionDays}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        tutor.avgScore >= 75
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : tutor.avgScore > 0
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {tutor.avgScore > 0 ? `${tutor.avgScore}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {tutor.avgAtt > 0 ? `${tutor.avgAtt}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        tutor.status === 'On Track'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : tutor.status === 'Needs Support'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}>
                        {tutor.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedTutorId(tutor.tutor_id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--brand)] hover:underline cursor-pointer"
                      >
                        <Filter className="w-3 h-3" />
                        View Trend
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExportDtrModal
        isOpen={isDtrExportOpen}
        onClose={() => setIsDtrExportOpen(false)}
        currentUser={user}
        attendanceLogs={staffAttendance}
      />
    </div>
  );
};
