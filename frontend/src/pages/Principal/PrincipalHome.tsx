import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance, PrincipalDashboardResponse, PrincipalDashboardTrendPoint } from '../../types';
import { ExportDtrModal } from '../../components/ExportDtrModal';
import { AlertCircle, RefreshCw, Download, ArrowUpRight, BarChart2 } from 'lucide-react';
import { StatsGridSkeleton, CardSkeleton } from '../../components/SkeletonLoader';

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

  const chartHeight = 220;
  const chartPadding = 36;
  const classChartWidth = Math.max(340, classTrend.length * 56);
  const staffChartWidth = Math.max(340, staffTrend.length * 56);
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
    },
    {
      label: 'Faculty',
      value: dashboardData?.program_summary.total_faculty ?? '—',
      subtext: 'Teaching staff',
    },
    {
      label: 'Students',
      value: totalStudents > 0 ? totalStudents : '—',
      subtext: 'Enrolled learners',
    },
    {
      label: 'Avg Score',
      value: avgClassScore > 0 ? `${avgClassScore}%` : '—',
      subtext: 'Class evaluation',
    },
    {
      label: 'Attendance Rate',
      value: avgClassAtt > 0 ? `${avgClassAtt}%` : '—',
      subtext: 'Session check-ins',
    },
    {
      label: 'High Risk',
      value: highRiskCount,
      subtext: `${highRiskPct}% of students`,
    },
  ];

  if (dashboardLoading) {
    return (
      <div className="flex flex-col gap-4 data-loaded-content w-full min-w-0 max-w-full">
        <StatsGridSkeleton count={4} cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <CardSkeleton rows={6} />
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={5} />
          </div>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-5 sm:p-6 text-rose-800 dark:text-rose-200">
        <p className="text-sm font-bold text-rose-900 dark:text-rose-200">Failed to load principal analytics</p>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">{dashboardError}</p>
        <button
          type="button"
          onClick={fetchDashboardData}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-rose-900/40 text-rose-700 dark:text-rose-200 text-xs font-semibold hover:bg-rose-100/60 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const staffTotal = (dashboardData?.program_summary.total_tutors || 0) + (dashboardData?.program_summary.total_faculty || 0);

  return (
    <div className="flex flex-col gap-4 data-loaded-content w-full min-w-0 max-w-full">
      {/* ── 1. Top Metrics KPI Strip (Clean, Minimalist, Generous Whitespace) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Learners */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Enrolled Learners
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {totalStudents > 0 ? totalStudents.toLocaleString() : '—'}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
            {lowRiskCount} low risk • {highRiskCount} high risk ({highRiskPct}%)
          </p>
        </div>

        {/* Metric 2: Academic Staff */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Academic Staff
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {staffTotal.toLocaleString()}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 truncate">
            {dashboardData?.program_summary.total_tutors ?? 0} Tutors • {dashboardData?.program_summary.total_faculty ?? 0} Faculty
          </p>
        </div>

        {/* Metric 3: Session Attendance */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Session Attendance
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {avgClassAtt > 0 ? `${avgClassAtt}%` : '—'}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Overall class session attendance rate
          </p>
        </div>

        {/* Metric 4: Evaluation Average */}
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
            Evaluation Average
          </span>
          <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {avgClassScore > 0 ? `${avgClassScore}%` : '—'}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Cohort student assessment performance
          </p>
        </div>
      </div>

      {/* ── 2. Streamlined Dashboard Layout (Clean Surfaces, Focused Hierarchy) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── Left Column (7 cols): Class Performance, Staff Attendance, and Tutor Cohorts ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Class Performance Trend Card */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-neutral-800">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                  {selectedTutorId !== 'all' && selectedTutorName
                    ? `${selectedTutorName.toUpperCase()}'S COHORT TREND`
                    : 'CLASS PERFORMANCE TREND'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Student progress and composite scores over time
                </p>
              </div>

              {/* Tutor Filter Select */}
              <div className="shrink-0">
                <select
                  aria-label="Filter by Tutor Cohort"
                  value={selectedTutorId}
                  onChange={(e) => setSelectedTutorId(e.target.value)}
                  style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-800 dark:text-slate-200 cursor-pointer outline-none transition focus:border-[var(--brand)] max-w-[190px] truncate"
                >
                  <option value="all">ALL TUTORS</option>
                  {dashboardData?.per_tutor_performance?.map((tutor) => (
                    <option key={tutor.tutor_id} value={tutor.tutor_id}>
                      {tutor.tutor_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chart Area */}
            <div className="relative min-h-[200px] w-full mt-4 bg-slate-50/50 dark:bg-neutral-950/40 border border-slate-100 dark:border-neutral-800/80 rounded-lg p-3 overflow-hidden">
              {hasClassTrendData ? (
                <div className="overflow-x-auto mobile-scroll-table -mx-1 px-1">
                  <svg width={classChartWidth} height={chartHeight} className="block mx-auto">
                    {[0, 1, 2, 3, 4].map((line) => {
                      const y = chartPadding + ((chartHeight - chartPadding * 1.5) / 4) * line;
                      return (
                        <line
                          key={line}
                          x1={chartPadding}
                          y1={y}
                          x2={classChartWidth - chartPadding}
                          y2={y}
                          stroke="rgba(148, 163, 184, 0.2)"
                          strokeWidth="1"
                        />
                      );
                    })}
                    <polyline
                      fill="none"
                      stroke="var(--brand)"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={buildCompositePoints(classTrend, classStepX)}
                    />
                    {classTrend.map((point, index) => {
                      const x = chartPadding + index * classStepX;
                      const compositeValue = compositeFromPrincipalPoint(point);
                      const compositeY = chartHeight - chartPadding - ((compositeValue / 100) * (chartHeight - chartPadding * 1.5));
                      return (
                        <circle key={point.date} cx={x} cy={compositeY} r="3.5" fill="var(--brand)" />
                      );
                    })}
                    {classTrend.map((point, index) => {
                      const x = chartPadding + index * classStepX;
                      return (
                        <text
                          key={point.date}
                          x={x}
                          y={chartHeight - chartPadding / 2.5}
                          textAnchor="middle"
                          fontSize="10"
                          className="fill-slate-500 dark:fill-slate-400 font-semibold"
                        >
                          {formatDateLabel(point.date)}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                  No class performance data available for this window.
                </div>
              )}
            </div>
          </div>

          {/* Staff Attendance Trend Card */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-neutral-800">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Staff Attendance Trend
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tutor and faculty session participation
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0 font-medium">
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                  Tutors
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Faculty
                </span>
              </div>
            </div>

            {/* Staff Chart Area */}
            <div className="relative min-h-[200px] w-full mt-4 bg-slate-50/50 dark:bg-neutral-950/40 border border-slate-100 dark:border-neutral-800/80 rounded-lg p-3 overflow-hidden">
              {hasStaffTrendData ? (
                <div className="overflow-x-auto mobile-scroll-table -mx-1 px-1">
                  <svg width={staffChartWidth} height={chartHeight} className="block mx-auto">
                    {[0, 1, 2, 3, 4].map((line) => {
                      const y = chartPadding + ((chartHeight - chartPadding * 1.5) / 4) * line;
                      return (
                        <line
                          key={line}
                          x1={chartPadding}
                          y1={y}
                          x2={staffChartWidth - chartPadding}
                          y2={y}
                          stroke="rgba(148, 163, 184, 0.2)"
                          strokeWidth="1"
                        />
                      );
                    })}
                    <polyline
                      fill="none"
                      stroke="var(--brand)"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={buildRatePoints('tutor', staffStepX)}
                    />
                    <polyline
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={buildRatePoints('faculty', staffStepX)}
                    />
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
                        <text
                          key={point.date}
                          x={x}
                          y={chartHeight - chartPadding / 2.5}
                          textAnchor="middle"
                          fontSize="10"
                          className="fill-slate-500 dark:fill-slate-400 font-semibold"
                        >
                          {formatDateLabel(point.date)}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                  No staff attendance data available for this window.
                </div>
              )}
            </div>
          </div>

          {/* Tutor Cohort Performance Card */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Tutor Cohort Performance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Evaluation metrics across active tutoring groups
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-800">
                {tutorCohortStats.length} Tutors Active
              </span>
            </div>

            {tutorCohortStats.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No tutor performance records found for this period.
              </div>
            ) : (
              <div className="overflow-x-auto mobile-scroll-table mt-1">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-neutral-800 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">
                      <th className="py-3 px-2 font-semibold">Tutor Name</th>
                      <th className="py-3 px-2 font-semibold text-center">Tracked Days</th>
                      <th className="py-3 px-2 font-semibold text-center">Avg Score</th>
                      <th className="py-3 px-2 font-semibold text-center">Attendance</th>
                      <th className="py-3 px-2 font-semibold text-center">Status</th>
                      <th className="py-3 px-2 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800/80">
                    {tutorCohortStats.map((tutor) => (
                      <tr
                        key={tutor.tutor_id}
                        className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-2 font-semibold text-slate-800 dark:text-slate-200">
                          {tutor.tutor_name}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-500 dark:text-slate-400 font-mono">
                          {tutor.sessionDays}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            tutor.avgScore >= 75
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                              : tutor.avgScore > 0
                              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                              : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400'
                          }`}>
                            {tutor.avgScore > 0 ? `${tutor.avgScore}%` : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-slate-700 dark:text-slate-300">
                          {tutor.avgAtt > 0 ? `${tutor.avgAtt}%` : '—'}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            tutor.status === 'On Track'
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                              : tutor.status === 'Needs Support'
                              ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                              : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-neutral-800'
                          }`}>
                            {tutor.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTutorId(tutor.tutor_id)}
                            className="text-xs font-semibold text-[#0052B7] dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column (5 cols): Executive Controls & Academic Risk ── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Executive Controls Card */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight pb-4 border-b border-slate-100 dark:border-neutral-800">
              Executive Controls
            </h2>

            {/* Timeframe Selector */}
            <div className="mt-4">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                Analytics Timeframe
              </label>
              <select
                value={dashboardDays}
                onChange={(e) => setDashboardDays(Number(e.target.value))}
                style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
                className="w-full h-9 px-3 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-800 dark:text-slate-200 cursor-pointer outline-none transition focus:border-[var(--brand)]"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>

            {/* Quick Action Tiles */}
            <div className="grid grid-cols-2 gap-2.5 mt-3.5">
              <button
                type="button"
                onClick={openDtrExport}
                disabled={isLoadingDtr}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors text-left group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                  {isLoadingDtr ? 'Loading…' : 'Export DTR'}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Staff logs report
                </span>
              </button>

              <button
                type="button"
                onClick={fetchDashboardData}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-neutral-800 hover:border-[#0052B7] dark:hover:border-blue-400 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors text-left group cursor-pointer"
              >
                <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#0052B7] dark:group-hover:text-blue-400 transition-colors">
                  Refresh
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Reload metrics
                </span>
              </button>
            </div>
          </div>

          {/* Academic Risk Distribution Card */}
          <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#000000] p-5 sm:p-6 transition-colors shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  Academic Risk Distribution
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cohort breakdown based on attendance & scores
                </p>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Total: <strong className="font-semibold text-slate-900 dark:text-white">{totalStudents}</strong>
              </span>
            </div>

            {/* Stacked Progress Bar */}
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-neutral-900 overflow-hidden flex gap-0.5">
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

              {/* Risk Tier List Rows */}
              <div className="divide-y divide-slate-100 dark:divide-neutral-800/80 mt-3">
                <div className="py-2.5 px-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">Low Risk (On Track)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{lowRiskPct}%</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{lowRiskCount}</span>
                  </div>
                </div>

                <div className="py-2.5 px-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">Medium Risk (Watchlist)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{medRiskPct}%</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{medRiskCount}</span>
                  </div>
                </div>

                <div className="py-2.5 px-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">High Risk (Intervention)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{highRiskPct}%</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{highRiskCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
