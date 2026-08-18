import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance, PrincipalDashboardResponse, PrincipalDashboardTrendPoint } from '../../types';
import { RefreshCw, Users, GraduationCap, Briefcase, Download, ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';
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
    ? (dashboardData?.per_tutor_performance?.find(t => t.tutor_id === selectedTutorId)?.trend ?? [])
    : (dashboardData?.class_performance_trend ?? []);
  const staffTrend = dashboardData?.staff_attendance_trend ?? [];
  const hasClassTrendData = classTrend.some(
    (point) => point.attendance_rate > 0 || point.average_score > 0
  );
  const hasStaffTrendData = staffTrend.some(
    (point) => point.tutor_attendance_rate > 0 || point.faculty_attendance_rate > 0
  );
  const selectedTutorName = selectedTutorId !== 'all'
    ? dashboardData?.per_tutor_performance?.find(t => t.tutor_id === selectedTutorId)?.tutor_name
    : null;

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

  // Unified stat cards — program summary + risk summary in one row
  const statCards = [
    {
      label: 'Tutors',
      value: dashboardData?.program_summary.total_tutors ?? '—',
      icon: Users,
      accentBg: 'bg-indigo-50',
      accentBorder: 'border-indigo-100',
      iconClass: 'text-indigo-500',
    },
    {
      label: 'Faculty',
      value: dashboardData?.program_summary.total_faculty ?? '—',
      icon: Briefcase,
      accentBg: 'bg-emerald-50',
      accentBorder: 'border-emerald-100',
      iconClass: 'text-emerald-600',
    },
    {
      label: 'Students',
      value: dashboardData?.program_summary.total_students ?? '—',
      icon: GraduationCap,
      accentBg: 'bg-amber-50',
      accentBorder: 'border-amber-100',
      iconClass: 'text-amber-600',
    },
    {
      label: 'High Risk',
      value: dashboardData?.risk_summary.high ?? '—',
      icon: ShieldAlert,
      accentBg: 'bg-rose-50',
      accentBorder: 'border-rose-100',
      iconClass: 'text-rose-500',
    },
    {
      label: 'Medium Risk',
      value: dashboardData?.risk_summary.medium ?? '—',
      icon: AlertTriangle,
      accentBg: 'bg-amber-50',
      accentBorder: 'border-amber-100',
      iconClass: 'text-amber-600',
    },
    {
      label: 'Low Risk',
      value: dashboardData?.risk_summary.low ?? '—',
      icon: CheckCircle,
      accentBg: 'bg-emerald-50',
      accentBorder: 'border-emerald-100',
      iconClass: 'text-emerald-600',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">ARAL Program Overview</p>
          <h2 className="mt-0.5 text-xl font-bold text-gray-900">Welcome, Principal {user?.last_name}!</h2>
          <p className="mt-0.5 text-xs text-gray-500 font-medium">
            Consolidated class and staff attendance trends.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center shrink-0">
          <select
            value={dashboardDays}
            onChange={(e) => setDashboardDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold bg-white text-gray-700"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center bg-green-50 text-green-700 hover:bg-green-100 px-3 py-2 rounded-lg text-xs font-semibold border border-green-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openDtrExport}
            disabled={isLoadingDtr}
            className="inline-flex items-center bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {isLoadingDtr ? 'Loading…' : 'Export DTR'}
          </button>
        </div>
      </div>

      {/* Unified Stat Cards — 6 compact cards in one row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.accentBg} border ${card.accentBorder} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4.5 h-4.5 ${card.iconClass}`} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{card.label}</p>
                <p className="text-xl font-extrabold text-gray-900 mt-0.5">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts — 2 compact panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Composite Performance Chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Composite Performance</p>
              <h3 className="text-sm font-semibold text-gray-900 mt-0.5">
                {selectedTutorId !== 'all' ? `${selectedTutorName}'s class` : 'All classes'}
              </h3>
            </div>
            <select
              value={selectedTutorId}
              onChange={(e) => setSelectedTutorId(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white text-gray-700"
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
              <div className="w-7 h-7 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : dashboardError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">{dashboardError}</div>
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
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
              No class performance data available for this window.
            </div>
          )}
        </div>

        {/* Staff Attendance Chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Attendance Rate</p>
              <h3 className="text-sm font-semibold text-gray-900 mt-0.5">Tutor & Faculty</h3>
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
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">{dashboardError}</div>
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
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
              No staff attendance data available for this window.
            </div>
          )}
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
