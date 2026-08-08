import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import type { Attendance, PrincipalDashboardResponse, PrincipalDashboardTrendPoint } from '../../types';
import { RefreshCw, Users, GraduationCap, Briefcase, BarChart3, Download } from 'lucide-react';
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

  const classChartWidth = Math.max(360, classTrend.length * 55);
  const staffChartWidth = Math.max(360, staffTrend.length * 55);
  const chartPadding = 40;
  const chartHeight = 220;
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

  const summaryCards = [
    {
      label: 'Tutors',
      value: dashboardData?.program_summary.total_tutors ?? '—',
      icon: Users,
      accent: 'bg-[var(--brand-light)] text-[var(--brand-dark)] border-[var(--brand-border)]',
    },
    {
      label: 'Faculty',
      value: dashboardData?.program_summary.total_faculty ?? '—',
      icon: Briefcase,
      accent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      label: 'Students',
      value: dashboardData?.program_summary.total_students ?? '—',
      icon: GraduationCap,
      accent: 'bg-amber-50 text-amber-700 border-amber-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Welcome, Principal {user?.last_name}!</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium">
            ARAL program oversight dashboard with consolidated class and staff attendance trends.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={dashboardDays}
            onChange={(e) => setDashboardDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white text-gray-700"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center bg-green-50 text-green-700 hover:bg-green-100 px-4 py-2.5 rounded-xl text-sm font-semibold border border-green-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Analytics
          </button>
          <button
            type="button"
            onClick={openDtrExport}
            disabled={isLoadingDtr}
            className="inline-flex items-center bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)] px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="w-4 h-4 mr-2" />
            {isLoadingDtr ? 'Loading DTR…' : 'Export Staff DTR'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-extrabold text-gray-900">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl border ${card.accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">High Risk Students</p>
          <p className="mt-3 text-3xl font-extrabold text-red-700">{dashboardData?.risk_summary.high ?? '—'}</p>
          <p className="mt-2 text-sm text-gray-500">Students with the highest academic risk in ARAL.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Medium Risk Students</p>
          <p className="mt-3 text-3xl font-extrabold text-amber-700">{dashboardData?.risk_summary.medium ?? '—'}</p>
          <p className="mt-2 text-sm text-gray-500">Students needing closer monitoring.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Low Risk Students</p>
          <p className="mt-3 text-3xl font-extrabold text-emerald-700">{dashboardData?.risk_summary.low ?? '—'}</p>
          <p className="mt-2 text-sm text-gray-500">Students currently in the lowest risk tier.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Composite performance</p>
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedTutorId !== 'all' ? `${selectedTutorName}'s composite class performance` : 'Consolidated ARAL class / section performance'}
              </h3>
            </div>
            <select
              value={selectedTutorId}
              onChange={(e) => setSelectedTutorId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold bg-white text-gray-700"
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
            <div className="flex justify-center items-center h-48">
              <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : dashboardError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{dashboardError}</div>
          ) : hasClassTrendData ? (
            <div className="overflow-x-auto">
              <svg width={classChartWidth} height={chartHeight} className="block mx-auto">
                {[0, 1, 2, 3, 4].map((line) => {
                  const y = chartPadding + ((chartHeight - chartPadding * 1.5) / 4) * line;
                  return <line key={line} x1={chartPadding} y1={y} x2={classChartWidth - chartPadding} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
                })}
                <polyline fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={buildCompositePoints(classTrend, classStepX)} />
                {classTrend.map((point, index) => {
                  const x = chartPadding + index * classStepX;
                  const compositeValue = compositeFromPrincipalPoint(point);
                  const compositeY = chartHeight - chartPadding - ((compositeValue / 100) * (chartHeight - chartPadding * 1.5));
                  return (
                    <g key={point.date}>
                      <circle cx={x} cy={compositeY} r="4" fill="var(--brand)" />
                    </g>
                  );
                })}
                {classTrend.map((point, index) => {
                  const x = chartPadding + index * classStepX;
                  return (
                    <text key={point.date} x={x} y={chartHeight - chartPadding / 2} textAnchor="middle" fontSize="10" fill="#6B7280">
                      {formatDateLabel(point.date)}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              No class performance data available for this window.
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Attendance rate</p>
              <h3 className="text-lg font-semibold text-gray-900">Tutor and faculty attendance rate</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--brand-light)]0"></span>Tutors</span>
              <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Faculty</span>
            </div>
          </div>

          {dashboardLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="w-8 h-8 border-4 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : dashboardError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{dashboardError}</div>
          ) : hasStaffTrendData ? (
            <div className="overflow-x-auto">
              <svg width={staffChartWidth} height={chartHeight} className="block mx-auto">
                {[0, 1, 2, 3, 4].map((line) => {
                  const y = chartPadding + ((chartHeight - chartPadding * 1.5) / 4) * line;
                  return <line key={line} x1={chartPadding} y1={y} x2={staffChartWidth - chartPadding} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
                })}
                <polyline fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={buildRatePoints('tutor', staffStepX)} />
                <polyline fill="none" stroke="#10B981" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={buildRatePoints('faculty', staffStepX)} />
                {staffTrend.map((point, index) => {
                  const x = chartPadding + index * staffStepX;
                  const tutorY = chartHeight - chartPadding - ((point.tutor_attendance_rate / 100) * (chartHeight - chartPadding * 1.5));
                  const facultyY = chartHeight - chartPadding - ((point.faculty_attendance_rate / 100) * (chartHeight - chartPadding * 1.5));
                  return (
                    <g key={point.date}>
                      <circle cx={x} cy={tutorY} r="4" fill="var(--brand)" />
                      <circle cx={x} cy={facultyY} r="4" fill="#10B981" />
                    </g>
                  );
                })}
                {staffTrend.map((point, index) => {
                  const x = chartPadding + index * staffStepX;
                  return (
                    <text key={point.date} x={x} y={chartHeight - chartPadding / 2} textAnchor="middle" fontSize="10" fill="#6B7280">
                      {formatDateLabel(point.date)}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              No staff attendance data available for this window.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <BarChart3 className="h-4 w-4 text-[var(--brand)]" />
          <span>ARAL program oversight dashboard with consolidated class and staff attendance trends.</span>
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
