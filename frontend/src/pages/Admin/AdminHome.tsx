import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { academicService } from '../../services/academicService';
import type { Attendance, Grade, User, UserStats } from '../../types';
import {
  BarChart2,
  AlertCircle,
  RefreshCw,
  Search,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { getRecentSchoolWeekdays, compareNamesByLastName } from '../../utils/studentFormatters';
import {
  getActiveSystemMilestone,
  getActiveSystemSemester,
  setActiveSystemSemester,
  isAssessmentWindowOpen,
  setAssessmentWindowOpen,
  SemesterType,
} from '../../utils/sessionDescriptionHelpers';
import {
  getChartAvailableAralLevels,
  getChartAvailableSubjects,
  getChartAvailableGrades,
  getChartAvailableSections,
  isStudentMatchingChartFilters,
} from '../../utils/tutorCohortHelpers';

// ─── Chart Types & Interactive Chart Component ─────────────────────────────────

interface AdminChartPoint {
  label: string;
  fullDateLabel?: string;
  dateRange: string;
  value: number;
  actualCount: number;
  attendanceCount?: number;
  assessmentLabels: string[];
}

const formatShortDateRange = (label: string): string => {
  const match = label.match(/^([A-Za-z]+)\s+(\d+)\s*[–—\-]\s*([A-Za-z]+)\s+(\d+)$/);
  if (match) {
    const [, m1, d1, m2, d2] = match;
    if (m1.toLowerCase() === m2.toLowerCase()) {
      return `${m1} ${d1}–${d2}`;
    }
    return `${m1} ${d1}–${m2} ${d2}`;
  }
  return label;
};

type TrendFilter = 'day' | 'week' | 'month';

const InteractiveAdminPerformanceChart: React.FC<{ data: AdminChartPoint[]; trendFilter: TrendFilter }> = ({ data, trendFilter }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 260 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.round(width),
            height: Math.round(height),
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const isMobile = width < 520;
  const isSmallMobile = width < 380;
  const paddingLeft = isMobile ? 44 : 50;
  const paddingRight = isMobile ? 20 : 14;
  const paddingTop = isMobile ? 18 : 20;
  const paddingBottom = isMobile ? 26 : 24;

  const chartW = Math.max(10, width - paddingLeft - paddingRight);
  const chartH = Math.max(10, height - paddingTop - paddingBottom);

  const points = data.map((d, idx) => {
    const x = paddingLeft + (idx * chartW) / (data.length - 1 || 1);
    const y = paddingTop + chartH - (d.value / 100) * chartH;
    return { x, y, ...d };
  });

  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p1.x - (p1.x - p0.x) / 3;
      const cp2y = p1.y;
      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`
    : '';

  // Dynamic tick density to prevent label overlap
  const visibleIndices = useMemo(() => {
    const total = data.length;
    if (total <= 1) return new Set([0]);
    if (!isMobile) {
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    if (trendFilter === 'month') {
      if (width < 380) {
        return new Set([0, 2, 4, total - 1]);
      }
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    if (trendFilter === 'week') {
      if (width < 430) {
        return new Set([0, 2, 4, total - 1]);
      }
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    // Day mode (10 school days)
    const step = isSmallMobile ? 3 : 2;
    const indices: number[] = [];
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    const lastIdx = total - 1;
    const prevIdx = indices[indices.length - 1];
    if (lastIdx - prevIdx >= 2) {
      indices.push(lastIdx);
    } else if (indices.length > 1) {
      indices[indices.length - 1] = lastIdx;
    }
    const set = new Set(indices);
    data.forEach((p, idx) => {
      if (p.assessmentLabels.length > 0 && !set.has(idx - 1) && !set.has(idx + 1)) {
        set.add(idx);
      }
    });
    return set;
  }, [data, isMobile, isSmallMobile, trendFilter, width]);

  const getFormattedLabel = (p: AdminChartPoint) => {
    if (!isMobile) return p.label;
    if (trendFilter === 'week') {
      return formatShortDateRange(p.label);
    }
    if (trendFilter === 'month') {
      if (width < 400) {
        return p.label.split(' ')[0] || p.label;
      }
      return p.label.replace(/\s+20(\d\d)/, " '$1");
    }
    return p.label;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full select-none min-w-0 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full block" role="img" aria-label="Performance Trend Chart">
        <defs>
          <linearGradient id="adminChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="adminChartGlow" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[0, 25, 50, 75, 100].map((val) => {
          const y = paddingTop + chartH - (val / 100) * chartH;
          return (
            <g key={val}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--slate-200)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <text x={paddingLeft - 8} y={y + 3} className="fill-slate-400 font-semibold text-[9px] xs:text-[10px]" textAnchor="end">
                {val}%
              </text>
            </g>
          );
        })}

        {/* Milestone guide lines */}
        {points.map((p, idx) => {
          if (p.assessmentLabels.length === 0) return null;
          return (
            <g key={`milestone-${idx}`}>
              <title>{p.assessmentLabels.join(', ')}</title>
              <line
                x1={p.x}
                y1={paddingTop}
                x2={p.x}
                y2={paddingTop + chartH}
                stroke="#38BDF8"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.35"
              />
            </g>
          );
        })}

        {/* X-axis date labels */}
        {points.map((p, idx) => {
          if (!visibleIndices.has(idx)) return null;

          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          let labelX = p.x;
          if (idx === 0) {
            textAnchor = 'start';
            labelX = Math.max(paddingLeft, p.x - 3);
          } else if (idx === points.length - 1) {
            textAnchor = 'end';
            labelX = Math.min(width - paddingRight, p.x + 3);
          }

          return (
            <text
              key={`label-${idx}`}
              x={labelX}
              y={height - (isMobile ? 6 : 5)}
              className="fill-slate-500 dark:fill-slate-400 font-semibold text-[9px] xs:text-[10px]"
              textAnchor={textAnchor}
              style={{ whiteSpace: 'nowrap' }}
            >
              {getFormattedLabel(p)}
            </text>
          );
        })}

        {/* Brand Trend Line & Area */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#adminChartFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.28"
              filter="url(#adminChartGlow)"
            />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Data point markers */}
        {points.map((p, idx) => (
          <circle
            key={`data-dot-${idx}`}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill="var(--brand)"
            stroke="#B6D4F8"
            strokeWidth="1.5"
          />
        ))}

        {/* Milestone assessment dots */}
        {points.map((p, idx) =>
          p.assessmentLabels.length > 0 ? (
            <g key={`milestone-dot-${idx}`}>
              <circle cx={p.x} cy={p.y} r="8.5" fill="#38BDF8" opacity="0.45" filter="url(#adminChartGlow)" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="#0284C7" stroke="#BAE6FD" strokeWidth="2" />
            </g>
          ) : null
        )}

        {/* Vertical line and dots on hover */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line
              x1={points[hoveredIdx].x}
              y1={paddingTop}
              x2={points[hoveredIdx].x}
              y2={paddingTop + chartH}
              stroke="var(--brand)"
              strokeWidth="1.5"
              opacity="0.7"
            />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="4.5" fill="var(--brand)" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="8" fill="var(--brand)" opacity="0.25" />
          </g>
        )}

        {/* Hover hit test regions */}
        {points.map((p, idx) => {
          const barW = chartW / (data.length - 1 || 1);
          const xStart = idx === 0 ? paddingLeft : p.x - barW / 2;
          const xEnd = idx === data.length - 1 ? width - paddingRight : p.x + barW / 2;
          return (
            <rect
              key={idx}
              x={xStart}
              y={paddingTop}
              width={xEnd - xStart}
              height={chartH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={() => setHoveredIdx(idx)}
              onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
            />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (() => {
        const p = points[hoveredIdx];
        const isRightHalf = p.x > width * 0.5;
        const maxTooltipWidth = Math.min(230, Math.max(160, width - 24));

        let tooltipStyle: React.CSSProperties;

        if (isMobile) {
          const leftPos = Math.max(10, Math.min(width - maxTooltipWidth - 10, p.x - maxTooltipWidth / 2));
          tooltipStyle = {
            left: `${leftPos}px`,
            top: '8px',
            maxWidth: `${maxTooltipWidth}px`,
          };
        } else if (isRightHalf) {
          tooltipStyle = {
            right: `${Math.max(10, width - p.x + 12)}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: `${maxTooltipWidth}px`,
          };
        } else {
          tooltipStyle = {
            left: `${Math.max(10, p.x + 12)}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: `${maxTooltipWidth}px`,
          };
        }

        return (
          <div
            className="pointer-events-none absolute z-20 w-max rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-[#000000]/95 p-3 text-left text-[11px] font-medium leading-normal text-slate-800 dark:text-white shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-black/60 backdrop-blur-md transition-all duration-150 overflow-hidden"
            style={tooltipStyle}
          >
            <div className="font-extrabold text-[11px] text-[#0052B7] dark:text-[#60A5FA] break-words">
              {p.fullDateLabel || p.label}
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className="text-sm font-extrabold"
                style={{
                  color: p.value >= 81 ? '#22C55E' : p.value >= 75 ? '#F59E0B' : '#EF4444',
                }}
              >
                {p.value}%
              </span>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400">Average Composite Rating</span>
            </div>
            {p.assessmentLabels.length > 0 && (
              <div className="mt-1.5 bg-sky-50 dark:bg-[#0284C7]/20 border border-sky-200 dark:border-[#0284C7]/40 text-sky-700 dark:text-[#38BDF8] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-sm dark:shadow-[0_0_8px_rgba(2,132,199,0.25)]">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-600 dark:bg-[#38BDF8] shadow-none dark:shadow-[0_0_6px_rgba(56,189,248,0.8)] inline-block" />
                <span className="uppercase tracking-wider">{p.assessmentLabels.join(', ')}</span>
              </div>
            )}
            <div className="text-[9px] text-slate-500 dark:text-zinc-400 mt-1 border-t border-slate-100 dark:border-zinc-800 pt-1 space-y-0.5">
              <div>
                {p.actualCount > 0
                  ? `${p.actualCount} ${p.actualCount === 1 ? 'assessment' : 'assessments'} logged`
                  : 'No assessments logged'}
              </div>
              <div>
                {(p.attendanceCount ?? 0) > 0
                  ? `${p.attendanceCount} attendance record${p.attendanceCount === 1 ? '' : 's'}`
                  : 'No attendance records'}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Staff DTR Attendance Chart Component ──────────────────────────────────────

interface StaffAttendanceChartPoint {
  label: string;
  fullDateLabel?: string;
  dateRange: string;
  value: number;
  presentCount: number;
  totalCount: number;
}

const InteractiveStaffAttendanceChart: React.FC<{
  data: StaffAttendanceChartPoint[];
  trendFilter: TrendFilter;
}> = ({ data, trendFilter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 260 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.round(width),
            height: Math.round(height),
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const isMobile = width < 520;
  const isSmallMobile = width < 380;
  const paddingLeft = isMobile ? 44 : 50;
  const paddingRight = isMobile ? 20 : 14;
  const paddingTop = isMobile ? 18 : 20;
  const paddingBottom = isMobile ? 26 : 24;

  const chartW = Math.max(10, width - paddingLeft - paddingRight);
  const chartH = Math.max(10, height - paddingTop - paddingBottom);

  const points = data.map((d, idx) => {
    const x = paddingLeft + (idx * chartW) / (data.length - 1 || 1);
    const y = paddingTop + chartH - (d.value / 100) * chartH;
    return { x, y, ...d };
  });

  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p1.x - (p1.x - p0.x) / 3;
      const cp2y = p1.y;
      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`
      : '';

  const visibleIndices = useMemo(() => {
    const total = data.length;
    if (total <= 1) return new Set([0]);
    if (!isMobile) {
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    if (trendFilter === 'month') {
      if (width < 380) {
        return new Set([0, 2, 4, total - 1]);
      }
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    if (trendFilter === 'week') {
      if (width < 430) {
        return new Set([0, 2, 4, total - 1]);
      }
      return new Set(Array.from({ length: total }, (_, i) => i));
    }
    const step = isSmallMobile ? 3 : 2;
    const indices: number[] = [];
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    const lastIdx = total - 1;
    const prevIdx = indices[indices.length - 1];
    if (lastIdx - prevIdx >= 2) {
      indices.push(lastIdx);
    } else if (indices.length > 1) {
      indices[indices.length - 1] = lastIdx;
    }
    return new Set(indices);
  }, [data, isMobile, isSmallMobile, trendFilter, width]);

  const getFormattedLabel = (p: StaffAttendanceChartPoint) => {
    if (trendFilter === 'month') {
      if (width < 400) {
        return p.label.split(' ')[0] || p.label;
      }
      return p.label.replace(/\s+20(\d\d)/, " '$1");
    }
    return p.label;
  };

  const target80Y = paddingTop + chartH - (80 / 100) * chartH;

  return (
    <div ref={containerRef} className="relative w-full h-full select-none min-w-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full block"
        role="img"
        aria-label="Staff DTR Attendance Rate Trend Chart"
      >
        <defs>
          <linearGradient id="adminStaffAttendanceChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="adminStaffAttendanceGlow" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid lines and number labels */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = paddingTop + chartH - (val / 100) * chartH;
          return (
            <g key={`admin-staff-grid-${val}`}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--slate-200)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                className="fill-slate-400 font-semibold text-[9px] xs:text-[10px]"
                textAnchor="end"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* 80% Benchmark Reference Line */}
        <line
          x1={paddingLeft}
          y1={target80Y}
          x2={width - paddingRight}
          y2={target80Y}
          stroke="#38BDF8"
          strokeDasharray="3 3"
          strokeOpacity="0.45"
          strokeWidth="1"
        />

        {/* X-axis date labels */}
        {points.map((p, idx) => {
          if (!visibleIndices.has(idx)) return null;

          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          let labelX = p.x;
          if (idx === 0) {
            textAnchor = 'start';
            labelX = Math.max(paddingLeft, p.x - 3);
          } else if (idx === points.length - 1) {
            textAnchor = 'end';
            labelX = Math.min(width - paddingRight, p.x + 3);
          }

          return (
            <text
              key={`admin-staff-label-${idx}`}
              x={labelX}
              y={height - (isMobile ? 6 : 5)}
              className="fill-slate-500 dark:fill-slate-400 font-semibold text-[9px] xs:text-[10px]"
              textAnchor={textAnchor}
              style={{ whiteSpace: 'nowrap' }}
            >
              {getFormattedLabel(p)}
            </text>
          );
        })}

        {/* Brand Trend Line & Area (Blue Theme) */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#adminStaffAttendanceChartFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.28"
              filter="url(#adminStaffAttendanceGlow)"
            />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Data point markers */}
        {points.map((p, idx) => (
          <circle
            key={`admin-staff-dot-${idx}`}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill="var(--brand)"
            stroke="#B6D4F8"
            strokeWidth="1.5"
          />
        ))}

        {/* Hover vertical line and dots */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <g>
            <line
              x1={points[hoveredIdx].x}
              y1={paddingTop}
              x2={points[hoveredIdx].x}
              y2={paddingTop + chartH}
              stroke="var(--brand)"
              strokeWidth="1.5"
              opacity="0.7"
            />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="4.5" fill="var(--brand)" />
            <circle cx={points[hoveredIdx].x} cy={points[hoveredIdx].y} r="8" fill="var(--brand)" opacity="0.25" />
          </g>
        )}

        {/* Hit test regions */}
        {points.map((p, idx) => {
          const barW = chartW / (data.length - 1 || 1);
          const xStart = idx === 0 ? paddingLeft : p.x - barW / 2;
          const xEnd = idx === data.length - 1 ? width - paddingRight : p.x + barW / 2;
          return (
            <rect
              key={`admin-staff-hit-${idx}`}
              x={xStart}
              y={paddingTop}
              width={Math.max(12, xEnd - xStart)}
              height={chartH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchStart={() => setHoveredIdx(idx)}
              onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
            />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (() => {
        const p = points[hoveredIdx];
        const isRightHalf = p.x > width * 0.5;
        const maxTooltipWidth = Math.min(230, Math.max(160, width - 24));

        let tooltipStyle: React.CSSProperties;

        if (isMobile) {
          const leftPos = Math.max(10, Math.min(width - maxTooltipWidth - 10, p.x - maxTooltipWidth / 2));
          tooltipStyle = {
            left: `${leftPos}px`,
            top: '8px',
            maxWidth: `${maxTooltipWidth}px`,
          };
        } else if (isRightHalf) {
          tooltipStyle = {
            right: `${Math.max(10, width - p.x + 12)}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: `${maxTooltipWidth}px`,
          };
        } else {
          tooltipStyle = {
            left: `${Math.max(10, p.x + 12)}px`,
            top: '50%',
            transform: 'translateY(-50%)',
            maxWidth: `${maxTooltipWidth}px`,
          };
        }

        return (
          <div
            className="pointer-events-none absolute z-20 w-max rounded-xl border border-slate-200 dark:border-neutral-800 bg-white/95 dark:bg-[#000000]/95 p-3 text-left text-[11px] font-medium leading-normal text-slate-800 dark:text-white shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-black/60 backdrop-blur-md transition-all duration-150 overflow-hidden"
            style={tooltipStyle}
          >
            <div className="font-extrabold text-[11px] text-[#0052B7] dark:text-[#60A5FA] break-words">
              {p.fullDateLabel || p.label}
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className="text-sm font-extrabold"
                style={{
                  color: p.value >= 80 ? '#10B981' : p.value >= 70 ? '#F59E0B' : '#EF4444',
                }}
              >
                {p.value}%
              </span>
              <span className="text-[9px] text-slate-500 dark:text-zinc-400">Attendance Rate</span>
            </div>
            <div className="text-[9px] text-slate-500 dark:text-zinc-400 mt-1 border-t border-slate-100 dark:border-zinc-800 pt-1 space-y-0.5">
              <div>
                {p.totalCount > 0
                  ? `${p.presentCount} of ${p.totalCount} logged present`
                  : 'No DTR punches recorded'}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Main AdminHome Component ──────────────────────────────────────────────────

export const AdminHome: React.FC = () => {
  const { user } = useAuth();
  const isSuperUser = Boolean(user?.is_superuser);
  const evaluationPath = isSuperUser ? '/superadmin/evaluations' : '/admin/evaluations';
  const studentPath = isSuperUser ? '/superadmin/students' : '/admin/students';
  const attendancePath = isSuperUser ? '/superadmin/attendance' : '/admin/attendance';

  const [stats, setStats] = useState<UserStats | null>(null);
  const [tutors, setTutors] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [facultyList, setFacultyList] = useState<User[]>([]);
  const [adminsList, setAdminsList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');
  const [selectedTutorId, setSelectedTutorId] = useState<string>('all');
  const [selectedAralLevel, setSelectedAralLevel] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [staffTrendFilter, setStaffTrendFilter] = useState<TrendFilter>('week');
  const [activeSystemSem, setActiveSystemSem] = useState<SemesterType>(() => getActiveSystemSemester());
  const [isWindowOpen, setIsWindowOpen] = useState<boolean>(() => isAssessmentWindowOpen());
  const [tutorSearch, setTutorSearch] = useState<string>('');

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [statsData, tutorsData, studentsData, gradesData, attendanceData, facultyData, adminsData] = await Promise.all([
          userService.getStats().catch((err) => {
            console.warn('Could not load stats for admin dashboard:', err);
            return null;
          }),
          userService.getAllUsers({ role: 'tutor' }).catch((err) => {
            console.warn('Could not load tutors:', err);
            return [] as User[];
          }),
          userService.getAllUsers({ role: 'student' }).catch((err) => {
            console.warn('Could not load students:', err);
            return [] as User[];
          }),
          academicService.getGrades().catch((err) => {
            console.warn('Could not load grades for admin dashboard:', err);
            return [] as Grade[];
          }),
          academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
          userService.getAllUsers({ role: 'faculty' }).catch(() => [] as User[]),
          userService.getAllUsers({ role: 'admin' }).catch(() => [] as User[]),
        ]);

        setStats(statsData);
        setTutors(Array.isArray(tutorsData) ? tutorsData : []);
        setStudents(Array.isArray(studentsData) ? studentsData : []);
        setGrades(Array.isArray(gradesData) ? gradesData : []);
        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
        setFacultyList(Array.isArray(facultyData) ? facultyData : []);
        setAdminsList(Array.isArray(adminsData) ? adminsData : []);
      } catch (err: any) {
        console.error('AdminHome fetch error:', err);
        setError(err?.response?.data?.detail || 'Failed to load school administration dashboard.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    academicService
      .getCurrentSchoolYear()
      .then((sy) => {
        if (sy && sy.current_semester) {
          setActiveSystemSemester(sy.current_semester as any);
          setActiveSystemSem(sy.current_semester as any);
          setIsWindowOpen(isAssessmentWindowOpen(sy.current_semester as any));
        }
      })
      .catch(() => {});

    const handleSemChange = (e: any) => {
      const newSem = e?.detail?.semester || getActiveSystemSemester();
      setActiveSystemSem(newSem);
      setIsWindowOpen(isAssessmentWindowOpen(newSem));
    };

    const handleWindowChange = (e: any) => {
      if (typeof e?.detail?.isOpen === 'boolean') {
        setIsWindowOpen(e.detail.isOpen);
      } else {
        setIsWindowOpen(isAssessmentWindowOpen());
      }
    };

    window.addEventListener('system_semester_changed', handleSemChange);
    window.addEventListener('assessment_window_changed', handleWindowChange);
    return () => {
      window.removeEventListener('system_semester_changed', handleSemChange);
      window.removeEventListener('assessment_window_changed', handleWindowChange);
    };
  }, []);

  const adminMilestone = useMemo(() => {
    return getActiveSystemMilestone();
  }, [activeSystemSem]);

  const handleToggleAssessmentWindow = () => {
    const nextState = !isWindowOpen;
    setIsWindowOpen(nextState);
    setAssessmentWindowOpen(nextState, activeSystemSem);
  };

  const selectedTutorObj = useMemo(() => {
    if (selectedTutorId === 'all') return null;
    return tutors.find((t) => String(t.id) === String(selectedTutorId)) || null;
  }, [tutors, selectedTutorId]);

  // Dynamic filter choices adjusting to the selected tutor and parent filters
  const chartAralLevels = useMemo(() => {
    return getChartAvailableAralLevels(selectedTutorObj);
  }, [selectedTutorObj]);

  const chartSubjects = useMemo(() => {
    return getChartAvailableSubjects(selectedTutorObj, selectedAralLevel);
  }, [selectedTutorObj, selectedAralLevel]);

  const chartGrades = useMemo(() => {
    return getChartAvailableGrades(selectedTutorObj, students);
  }, [selectedTutorObj, students]);

  const chartSections = useMemo(() => {
    return getChartAvailableSections(selectedTutorObj, selectedGrade, students);
  }, [selectedTutorObj, selectedGrade, students]);

  // When selected tutor changes, auto-adjust other dropdowns to the tutor's handled class
  const prevTutorIdRef = useRef(selectedTutorId);
  useEffect(() => {
    if (prevTutorIdRef.current !== selectedTutorId) {
      prevTutorIdRef.current = selectedTutorId;
      if (selectedTutorId === 'all') {
        setSelectedAralLevel('all');
        setSelectedSubject('all');
        setSelectedGrade('all');
        setSelectedSection('all');
      } else if (selectedTutorObj) {
        // 1. ARAL level
        const avLevels = getChartAvailableAralLevels(selectedTutorObj);
        const nextLevel =
          avLevels.length === 1
            ? avLevels[0].id
            : avLevels.some((l) => l.id === selectedAralLevel)
            ? selectedAralLevel
            : 'all';
        setSelectedAralLevel(nextLevel);

        // 2. Subject
        const avSubjects = getChartAvailableSubjects(selectedTutorObj, nextLevel);
        const nextSub =
          avSubjects.length === 1
            ? avSubjects[0].id
            : avSubjects.some((s) => s.id === selectedSubject)
            ? selectedSubject
            : 'all';
        setSelectedSubject(nextSub);

        // 3. Grade
        const avGrades = getChartAvailableGrades(selectedTutorObj, students);
        const nextGrade =
          avGrades.length === 1
            ? avGrades[0]
            : avGrades.includes(selectedGrade)
            ? selectedGrade
            : 'all';
        setSelectedGrade(nextGrade);

        // 4. Section
        const avSections = getChartAvailableSections(selectedTutorObj, nextGrade, students);
        const nextSec =
          avSections.length === 1
            ? avSections[0]
            : avSections.includes(selectedSection)
            ? selectedSection
            : 'all';
        setSelectedSection(nextSec);
      }
    }
  }, [selectedTutorId, selectedTutorObj, students, selectedAralLevel, selectedSubject, selectedGrade, selectedSection]);

  // Reactive auto-adjustment when parent filters (ARAL level / Grade) change
  useEffect(() => {
    if (selectedTutorId !== 'all' && chartAralLevels.length === 1) {
      if (selectedAralLevel !== chartAralLevels[0].id) {
        setSelectedAralLevel(chartAralLevels[0].id);
      }
    } else if (selectedAralLevel !== 'all' && !chartAralLevels.some((l) => l.id === selectedAralLevel)) {
      setSelectedAralLevel('all');
    }
  }, [selectedAralLevel, chartAralLevels, selectedTutorId]);

  useEffect(() => {
    if (selectedTutorId !== 'all' && chartSubjects.length === 1) {
      if (selectedSubject !== chartSubjects[0].id) {
        setSelectedSubject(chartSubjects[0].id);
      }
    } else if (selectedSubject !== 'all' && !chartSubjects.some((s) => s.id === selectedSubject)) {
      setSelectedSubject('all');
    }
  }, [selectedSubject, chartSubjects, selectedTutorId]);

  useEffect(() => {
    if (selectedTutorId !== 'all' && chartGrades.length === 1) {
      if (selectedGrade !== chartGrades[0]) {
        setSelectedGrade(chartGrades[0]);
      }
    } else if (selectedGrade !== 'all' && !chartGrades.includes(selectedGrade)) {
      setSelectedGrade('all');
    }
  }, [selectedGrade, chartGrades, selectedTutorId]);

  useEffect(() => {
    if (selectedTutorId !== 'all' && chartSections.length === 1) {
      if (selectedSection !== chartSections[0]) {
        setSelectedSection(chartSections[0]);
      }
    } else if (selectedSection !== 'all' && !chartSections.includes(selectedSection)) {
      setSelectedSection('all');
    }
  }, [selectedSection, chartSections, selectedTutorId]);

  // Filter students based on selected tutor and additional chart filters
  const filteredStudents = useMemo(() => {
    return students.filter((s) =>
      isStudentMatchingChartFilters(s, {
        tutorId: selectedTutorId,
        aralLevel: selectedAralLevel,
        subject: selectedSubject,
        grade: selectedGrade,
        section: selectedSection,
      })
    );
  }, [students, selectedTutorId, selectedAralLevel, selectedSubject, selectedGrade, selectedSection]);

  // ── Stakeholder-Validated Overall Metrics Calculations (Always for ALL students) ──
  const studentRiskRows = useMemo(() => {
    if (students.length === 0) return [];
    return computeStudentRiskRows(students, grades, attendance);
  }, [students, grades, attendance]);

  const highRiskStudents = useMemo(
    () => studentRiskRows.filter((s) => s.riskTier === 'High'),
    [studentRiskRows]
  );

  const hasAttendanceData = useMemo(() => {
    const studentIds = new Set(students.map((s) => String(s.id)));
    const hasLogs = attendance.some((a) => {
      const aUser = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
      const aUserId = (a as any).user_id || (a as any).student_id;
      return studentIds.has(String(aUser)) || studentIds.has(String(aUserId));
    });
    if (hasLogs) return true;
    if ((stats?.attendance_summary?.total_logs ?? 0) > 0) return true;
    if ((stats?.academic_summary?.average_attendance_rate ?? 0) > 0) return true;
    return false;
  }, [students, attendance, stats]);

  const hasScoreData = useMemo(() => {
    const studentIds = new Set(students.map((s) => String(s.id)));
    const hasScores = grades.some((g) => {
      const gStudent = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
      const gStudentId = (g as any).student_id;
      const isStudent = studentIds.has(String(gStudent)) || studentIds.has(String(gStudentId));
      return isStudent && g.component_type !== 'attendance' && g.remarks?.trim().toLowerCase() !== 'not taken';
    });
    if (hasScores) return true;
    if ((stats?.academic_summary?.average_score ?? 0) > 0) return true;
    return false;
  }, [students, grades, stats]);

  const overallAttendanceRate = useMemo(() => {
    if (studentRiskRows.length > 0 && attendance.length > 0) {
      const studentIds = new Set(students.map((s) => String(s.id)));
      const matchingAtt = attendance.filter((a) => {
        const aUser = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
        const aUserId = (a as any).user_id || (a as any).student_id;
        return studentIds.has(String(aUser)) || studentIds.has(String(aUserId));
      });
      if (matchingAtt.length > 0) {
        const presentCount = matchingAtt.filter((a) => a.status === 'present').length;
        return Math.round((presentCount / matchingAtt.length) * 1000) / 10;
      }
    }
    if (stats?.academic_summary?.average_attendance_rate !== undefined && stats.academic_summary.average_attendance_rate > 0) {
      return stats.academic_summary.average_attendance_rate;
    }
    if (stats?.attendance_summary && stats.attendance_summary.total_logs > 0) {
      return Math.round((stats.attendance_summary.present / stats.attendance_summary.total_logs) * 1000) / 10;
    }
    return 0;
  }, [studentRiskRows, attendance, students, stats]);

  const overallAvgScore = useMemo(() => {
    if (studentRiskRows.length > 0 && hasScoreData) {
      const validScores = studentRiskRows.filter((r) => r.scoreAvg > 0);
      if (validScores.length > 0) {
        const total = validScores.reduce((sum, r) => sum + r.scoreAvg, 0);
        return Math.round((total / validScores.length) * 10) / 10;
      }
    }
    if (stats?.academic_summary?.average_score !== undefined && stats.academic_summary.average_score > 0) {
      return stats.academic_summary.average_score;
    }
    return 0;
  }, [studentRiskRows, hasScoreData, stats]);

  const overallCompositeScore = useMemo(() => {
    if (overallAttendanceRate > 0 && overallAvgScore > 0) {
      return Math.round(((overallAttendanceRate * 0.4) + (overallAvgScore * 0.6)) * 10) / 10;
    }
    if (overallAttendanceRate > 0) return overallAttendanceRate;
    if (overallAvgScore > 0) return overallAvgScore;
    return 0;
  }, [overallAttendanceRate, overallAvgScore]);

  // Compute performance trend combining composite scores
  const chartTrendData = useMemo(() => {
    if (filteredStudents.length === 0 || grades.length === 0) return [];
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const assessmentGrades = grades.filter((g) => {
      const gStudent = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
      const gStudentId = (g as any).student_id;
      const matchesStudent = studentIds.has(String(gStudent)) || studentIds.has(String(gStudentId));
      if (!matchesStudent) return false;

      if (selectedSubject !== 'all') {
        const gSub = (g.subject || '').toLowerCase().trim();
        const targetSub = selectedSubject.toLowerCase().trim();
        const matchesLanguage =
          (targetSub === 'reading' && (gSub === 'reading' || gSub === 'filipino')) ||
          (targetSub === 'filipino' && (gSub === 'reading' || gSub === 'filipino'));
        if (!matchesLanguage && gSub !== targetSub) return false;
      }
      return g.component_type === 'assessment';
    });
    if (assessmentGrades.length === 0) return [];

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formatMonth = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

    let periods: {
      label: string;
      fullDateLabel?: string;
      dateRange: string;
      start: Date;
      end: Date;
      scores: number[];
      attendanceCount: number;
      assessmentLabels: Set<string>;
    }[];

    if (trendFilter === 'day') {
      const schoolDays = getRecentSchoolWeekdays(10, now);
      periods = schoolDays.map((d) => {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
        const weekdayName = start.toLocaleDateString('en-US', { weekday: 'long' });
        const monthFull = start.toLocaleDateString('en-US', { month: 'long' });
        const dayNum = start.getDate();
        const year = start.getFullYear();
        const label = formatDate(start);
        const fullDateLabel = `${monthFull} ${dayNum}, ${year} | ${weekdayName}`;
        return {
          label,
          fullDateLabel,
          dateRange: fullDateLabel,
          start,
          end,
          scores: [] as number[],
          attendanceCount: 0,
          assessmentLabels: new Set<string>(),
        };
      });
    } else {
      const periodCount = 6;
      periods = Array.from({ length: periodCount }).map((_, index) => {
        let start: Date, end: Date, label: string, fullDateLabel: string;
        if (trendFilter === 'month') {
          const offset = periodCount - 1 - index;
          start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
          label = formatMonth(start);
          const monthFull = start.toLocaleDateString('en-US', { month: 'long' });
          const year = start.getFullYear();
          fullDateLabel = `${monthFull} ${year}`;
        } else {
          // week (5 school weekdays: Mon–Fri)
          const offset = periodCount - 1 - index;
          const dayOfWeek = now.getDay();
          const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const currentWeekMon = new Date(startOfToday.getTime() + diffToMon * oneDay);
          start = new Date(currentWeekMon.getTime() - offset * 7 * oneDay);
          const fri = new Date(start.getTime() + 4 * oneDay);
          end = new Date(start.getTime() + 5 * oneDay);
          label = `${formatDate(start)} – ${formatDate(fri)}`;
          const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
          const friMonth = fri.toLocaleDateString('en-US', { month: 'long' });
          const startDay = start.getDate();
          const friDay = fri.getDate();
          const friYear = fri.getFullYear();
          const rangeText = startMonth === friMonth
            ? `${startMonth} ${startDay}–${friDay}, ${friYear}`
            : `${startMonth} ${startDay} – ${friMonth} ${friDay}, ${friYear}`;
          fullDateLabel = `${rangeText} | Monday – Friday`;
        }
        return {
          label,
          fullDateLabel,
          dateRange: fullDateLabel,
          start,
          end,
          scores: [] as number[],
          attendanceCount: 0,
          assessmentLabels: new Set<string>(),
        };
      });
    }

    assessmentGrades.forEach((g) => {
      const dateStr = g.date_logged ? g.date_logged.slice(0, 10) : '';
      if (!dateStr) return;
      const gDate = new Date(`${dateStr}T00:00:00`);
      if (isNaN(gDate.getTime())) return;
      for (const p of periods) {
        if (gDate >= p.start && gDate < p.end) {
          const scorePercent = g.total_score > 0 ? (g.score / g.total_score) * 100 : g.score;
          p.scores.push(scorePercent);
          const assessmentText = `${g.subject} ${g.remarks ?? ''}`.toUpperCase();
          if (assessmentText.includes(adminMilestone.toUpperCase())) {
            p.assessmentLabels.add(adminMilestone);
          } else if (assessmentText.includes('ARAL SUMMER') || assessmentText.includes('SUMMER') || assessmentText.includes('BOSY')) {
            p.assessmentLabels.add('ARAL Summer Assessment');
          } else if (assessmentText.includes('MOSY')) {
            p.assessmentLabels.add('MOSY');
          } else if (assessmentText.includes('EOSY')) {
            p.assessmentLabels.add('EOSY');
          }
          break;
        }
      }
    });

    attendance.forEach((att) => {
      if (!studentIds.has(String(att.user))) return;
      const dateStr = att.date ? att.date.slice(0, 10) : '';
      if (!dateStr) return;
      const attDate = new Date(`${dateStr}T00:00:00`);
      if (isNaN(attDate.getTime())) return;
      for (const p of periods) {
        if (attDate >= p.start && attDate < p.end) {
          p.attendanceCount += 1;
          break;
        }
      }
    });

    const points = periods.map((p) => ({
      label: p.label,
      fullDateLabel: p.fullDateLabel,
      dateRange: p.dateRange,
      value: p.scores.length > 0 ? Math.round(p.scores.reduce((a, b) => a + b, 0) / p.scores.length) : null,
      count: p.scores.length,
      attendanceCount: p.attendanceCount,
      assessmentLabels: Array.from(p.assessmentLabels),
    }));

    if (points.every((p) => p.value === null)) return [];

    let lastValid = 75;
    return points.map((p) => {
      if (p.value !== null) lastValid = p.value;
      return {
        label: p.label,
        fullDateLabel: p.fullDateLabel,
        dateRange: p.dateRange,
        value: p.value !== null ? p.value : lastValid,
        actualCount: p.count,
        attendanceCount: p.attendanceCount,
        assessmentLabels: p.assessmentLabels,
      };
    });
  }, [filteredStudents, grades, attendance, trendFilter, adminMilestone, selectedSubject]);

  const highestScore = useMemo(() => (chartTrendData.length === 0 ? 0 : Math.max(...chartTrendData.map((d) => d.value))), [chartTrendData]);
  const lowestScore = useMemo(() => (chartTrendData.length === 0 ? 0 : Math.min(...chartTrendData.map((d) => d.value))), [chartTrendData]);

  const trendDir = useMemo(() => {
    if (chartTrendData.length < 2) return 'stable';
    const first = chartTrendData[0].value;
    const last = chartTrendData[chartTrendData.length - 1].value;
    return last > first ? 'up' : last < first ? 'down' : 'stable';
  }, [chartTrendData]);

  // ── Staff DTR Attendance Filter Lists & Trend Data ───────────────────────────
  const staffTutors = useMemo(() => {
    const map = new Map<string, string>();
    tutors.forEach((t) => {
      const name = t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.username;
      if (t.id) map.set(String(t.id), name);
    });
    attendance.forEach((a) => {
      if ((a.role || '').toLowerCase() === 'tutor') {
        const id = String(a.user || (a as any).tutor || '');
        const name = a.user_name || (a as any).tutor_name || '';
        if (id && name && !map.has(id)) map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tutors, attendance]);

  const staffFaculty = useMemo(() => {
    const map = new Map<string, string>();
    facultyList.forEach((f) => {
      const name = f.full_name || `${f.first_name || ''} ${f.last_name || ''}`.trim() || f.username;
      if (f.id) map.set(String(f.id), name);
    });
    attendance.forEach((a) => {
      if ((a.role || '').toLowerCase() === 'faculty') {
        const id = String(a.user || '');
        const name = a.user_name || '';
        if (id && name && !map.has(id)) map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [facultyList, attendance]);

  const staffAdmins = useMemo(() => {
    const map = new Map<string, string>();
    adminsList.forEach((ad) => {
      const name = ad.full_name || `${ad.first_name || ''} ${ad.last_name || ''}`.trim() || ad.username;
      if (ad.id) map.set(String(ad.id), name);
    });
    attendance.forEach((a) => {
      if ((a.role || '').toLowerCase() === 'admin') {
        const id = String(a.user || '');
        const name = a.user_name || '';
        if (id && name && !map.has(id)) map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [adminsList, attendance]);

  const staffChartTitle = useMemo(() => {
    if (selectedStaffFilter === 'all') {
      return 'STAFF DTR ATTENDANCE RATE';
    }
    if (selectedStaffFilter === 'role:tutor') {
      return 'TUTORS DTR ATTENDANCE RATE';
    }
    if (selectedStaffFilter === 'role:faculty') {
      return 'FACULTY DTR ATTENDANCE RATE';
    }
    if (selectedStaffFilter === 'role:admin') {
      return 'ADMINISTRATORS DTR ATTENDANCE RATE';
    }
    if (selectedStaffFilter.startsWith('user:')) {
      const uid = selectedStaffFilter.replace('user:', '');
      const t = staffTutors.find((x) => String(x.id) === uid);
      if (t) return `${t.name.toUpperCase()}'S DTR ATTENDANCE RATE`;
      const f = staffFaculty.find((x) => String(x.id) === uid);
      if (f) return `${f.name.toUpperCase()}'S DTR ATTENDANCE RATE`;
      const ad = staffAdmins.find((x) => String(x.id) === uid);
      if (ad) return `${ad.name.toUpperCase()}'S DTR ATTENDANCE RATE`;
    }
    return 'STAFF DTR ATTENDANCE RATE';
  }, [selectedStaffFilter, staffTutors, staffFaculty, staffAdmins]);

  const staffAttendanceTrendData = useMemo<StaffAttendanceChartPoint[]>(() => {
    const isTargetStaffLog = (a: Attendance) => {
      const r = (a.role || '').toLowerCase();
      if (r === 'student') return false;

      const userIdStr = String(a.user || (a as any).user_id || (a as any).tutor || '');

      if (selectedStaffFilter === 'all') {
        return (
          ['tutor', 'faculty', 'admin', 'principal'].includes(r) ||
          staffTutors.some((t) => String(t.id) === userIdStr) ||
          staffFaculty.some((f) => String(f.id) === userIdStr) ||
          staffAdmins.some((ad) => String(ad.id) === userIdStr)
        );
      }
      if (selectedStaffFilter === 'role:tutor') {
        return r === 'tutor' || staffTutors.some((t) => String(t.id) === userIdStr);
      }
      if (selectedStaffFilter === 'role:faculty') {
        return r === 'faculty' || staffFaculty.some((f) => String(f.id) === userIdStr);
      }
      if (selectedStaffFilter === 'role:admin') {
        return r === 'admin' || staffAdmins.some((ad) => String(ad.id) === userIdStr);
      }
      if (selectedStaffFilter.startsWith('user:')) {
        const targetId = selectedStaffFilter.replace('user:', '');
        return userIdStr === targetId;
      }
      return true;
    };

    const isLogPresent = (a: Attendance) => {
      const st = (a.status || '').toLowerCase();
      if (st === 'present' || st === 'late') return true;
      if (a.arrival_am || a.departure_am || a.arrival_pm || a.departure_pm || a.time_in || a.time_out) {
        return true;
      }
      return false;
    };

    const relevantLogs = attendance.filter(isTargetStaffLog);

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const formatDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formatMonth = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

    let periods: {
      label: string;
      fullDateLabel: string;
      dateRange: string;
      start: Date;
      end: Date;
      presentCount: number;
      totalCount: number;
    }[];

    if (staffTrendFilter === 'day') {
      const schoolDays = getRecentSchoolWeekdays(10, now);
      periods = schoolDays.map((d) => {
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
        const weekdayName = start.toLocaleDateString('en-US', { weekday: 'long' });
        const monthFull = start.toLocaleDateString('en-US', { month: 'long' });
        const dayNum = start.getDate();
        const year = start.getFullYear();
        const label = formatDate(start);
        const fullDateLabel = `${monthFull} ${dayNum}, ${year} | ${weekdayName}`;
        return {
          label,
          fullDateLabel,
          dateRange: fullDateLabel,
          start,
          end,
          presentCount: 0,
          totalCount: 0,
        };
      });
    } else {
      const periodCount = 6;
      periods = Array.from({ length: periodCount }).map((_, index) => {
        let start: Date, end: Date, label: string, fullDateLabel: string;
        if (staffTrendFilter === 'month') {
          const offset = periodCount - 1 - index;
          start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
          label = formatMonth(start);
          const monthFull = start.toLocaleDateString('en-US', { month: 'long' });
          const year = start.getFullYear();
          fullDateLabel = `${monthFull} ${year}`;
        } else {
          // week (Mon–Fri)
          const offset = periodCount - 1 - index;
          const dayOfWeek = now.getDay();
          const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const currentWeekMon = new Date(startOfToday.getTime() + diffToMon * oneDay);
          start = new Date(currentWeekMon.getTime() - offset * 7 * oneDay);
          const fri = new Date(start.getTime() + 4 * oneDay);
          end = new Date(start.getTime() + 5 * oneDay);
          label = `${formatDate(start)} – ${formatDate(fri)}`;
          const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
          const friMonth = fri.toLocaleDateString('en-US', { month: 'long' });
          const startDay = start.getDate();
          const friDay = fri.getDate();
          const friYear = fri.getFullYear();
          const rangeText =
            startMonth === friMonth
              ? `${startMonth} ${startDay}–${friDay}, ${friYear}`
              : `${startMonth} ${startDay} – ${friMonth} ${friDay}, ${friYear}`;
          fullDateLabel = `${rangeText} | Monday – Friday`;
        }
        return {
          label,
          fullDateLabel,
          dateRange: fullDateLabel,
          start,
          end,
          presentCount: 0,
          totalCount: 0,
        };
      });
    }

    // Accumulate logs
    relevantLogs.forEach((log) => {
      if (!log.date) return;
      const logDate = new Date(`${log.date}T00:00:00`);
      if (isNaN(logDate.getTime())) return;

      for (const p of periods) {
        if (logDate >= p.start && logDate < p.end) {
          p.totalCount++;
          if (isLogPresent(log)) {
            p.presentCount++;
          }
        }
      }
    });

    return periods.map((p) => {
      const rate = p.totalCount > 0 ? Math.round((p.presentCount / p.totalCount) * 1000) / 10 : 0;
      return {
        label: p.label,
        fullDateLabel: p.fullDateLabel,
        dateRange: p.dateRange,
        value: rate,
        presentCount: p.presentCount,
        totalCount: p.totalCount,
      };
    });
  }, [attendance, selectedStaffFilter, staffTrendFilter, staffTutors, staffFaculty, staffAdmins]);

  const numericStaffAttendance = useMemo(
    () => staffAttendanceTrendData.map((d) => d.value).filter((v) => v > 0),
    [staffAttendanceTrendData]
  );
  const highestStaffAttendance = numericStaffAttendance.length > 0 ? Math.max(...numericStaffAttendance) : 0;
  const lowestStaffAttendance = numericStaffAttendance.length > 0 ? Math.min(...numericStaffAttendance) : 0;
  const avgStaffAttendance = numericStaffAttendance.length > 0
    ? Math.round((numericStaffAttendance.reduce((a, b) => a + b, 0) / numericStaffAttendance.length) * 10) / 10
    : 0;

  const staffTrendDir = useMemo(() => {
    if (staffAttendanceTrendData.length < 2) return 'neutral';
    const nonZero = staffAttendanceTrendData.filter((d) => d.value > 0);
    if (nonZero.length < 2) return 'neutral';
    const first = nonZero[0].value;
    const last = nonZero[nonZero.length - 1].value;
    if (last > first + 2) return 'up';
    if (last < first - 2) return 'down';
    return 'neutral';
  }, [staffAttendanceTrendData]);

  const totalStudentsCount = stats?.students ?? students.length;
  const totalTutorsCount = stats?.tutors ?? tutors.length;
  const totalFacultyCount = stats?.faculty ?? 0;
  const totalPrincipalsCount = stats?.principals ?? 0;
  const totalAdminsCount = stats?.admins ?? 0;

  // ── Tutor Assessment Status Derivations ──────────────────────────────────────
  const milestoneEvaluatedStudentIds = useMemo(() => {
    const set = new Set<string>();
    grades.forEach((g) => {
      if (g.component_type === 'assessment' && g.remarks?.trim().toLowerCase() !== 'not taken') {
        const sub = (g.subject || '').toUpperCase();
        const remarks = (g.remarks || '').toUpperCase();
        const matchMilestone =
          adminMilestone === 'ARAL Summer Assessment'
            ? sub.includes('SUMMER') || sub.includes('BOSY') || remarks.includes('SUMMER')
            : sub.includes(adminMilestone.toUpperCase()) || remarks.includes(adminMilestone.toUpperCase());
        if (matchMilestone) {
          const studentId = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
          if (studentId) set.add(String(studentId));
        }
      }
    });
    return set;
  }, [grades, adminMilestone]);

  const tutorAssessmentStatusList = useMemo(() => {
    const list = tutors.map((tutor) => {
      const tutorStudents = students.filter((s) => String(s.assigned_tutor) === String(tutor.id));
      const assignedCount = tutorStudents.length;
      const evaluatedCount = tutorStudents.filter((s) => milestoneEvaluatedStudentIds.has(String(s.id))).length;

      let status: 'SUBMITTED' | 'PENDING' | 'CLOSED';
      let label: string;
      let badgeClass: string;

      if (!isWindowOpen) {
        status = 'CLOSED';
        label = `${adminMilestone} Closed`;
        badgeClass = 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-zinc-700';
      } else if (assignedCount > 0 && evaluatedCount >= assignedCount) {
        status = 'SUBMITTED';
        label = `${adminMilestone} Submitted`;
        badgeClass = 'bg-emerald-50 dark:bg-emerald-950/40 text-risk-low border-emerald-200 dark:border-emerald-800/60';
      } else {
        status = 'PENDING';
        label = `${adminMilestone} Pending`;
        badgeClass = 'bg-amber-50 dark:bg-amber-950/40 text-risk-medium border-amber-200 dark:border-amber-800/60';
      }

      const isEvaluated = assignedCount > 0 && evaluatedCount >= assignedCount;

      return {
        tutor,
        assignedCount,
        evaluatedCount,
        status,
        label,
        badgeClass,
        isEvaluated,
      };
    });

    const statusOrder: Record<'PENDING' | 'SUBMITTED' | 'CLOSED', number> = {
      PENDING: 1,
      SUBMITTED: 2,
      CLOSED: 3,
    };

    return list.sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return compareNamesByLastName(a.tutor, b.tutor);
    });
  }, [tutors, students, milestoneEvaluatedStudentIds, isWindowOpen, adminMilestone]);

  const filteredTutorStatusList = useMemo(() => {
    if (!tutorSearch.trim()) return tutorAssessmentStatusList;
    const query = tutorSearch.toLowerCase().trim();
    return tutorAssessmentStatusList.filter((item) => {
      const name = (item.tutor.full_name || `${item.tutor.first_name} ${item.tutor.last_name}`).toLowerCase();
      const email = (item.tutor.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [tutorAssessmentStatusList, tutorSearch]);

  const conductedCount = useMemo(
    () => tutorAssessmentStatusList.filter((t) => t.isEvaluated).length,
    [tutorAssessmentStatusList]
  );

  const ratioBadgeClass = useMemo(() => {
    if (!isWindowOpen) {
      return 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-zinc-700';
    }
    if (tutors.length > 0 && conductedCount >= tutors.length) {
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-risk-low border-emerald-200 dark:border-emerald-800/60';
    }
    return 'bg-amber-50 dark:bg-amber-950/40 text-risk-medium border-amber-200 dark:border-amber-800/60';
  }, [isWindowOpen, tutors.length, conductedCount]);

  // ─── Loading Skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 data-loaded-content w-full min-w-0 max-w-full">
        {/* Row 1 Skeleton: 3 Multi-Layer Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {/* Card 1 Skeleton: 2 layers (Total Students & High Risk) */}
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] animate-pulse divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-2xs">
            {[1, 2].map((i) => (
              <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-2">
                <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-5 w-12 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
          {/* Card 2 Skeleton: 4 layers (Tutors, Faculty, Principal, Admin) */}
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] animate-pulse divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-2xs">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-1">
                <div className="h-2 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3.5 w-8 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
          {/* Card 3 Skeleton: 3 layers (Attendance, Score, Composite) */}
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] animate-pulse divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-2xs">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-1.5">
                <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Row 2 Skeleton: Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          <div className="lg:col-span-9 xl:col-span-9 flex flex-col gap-3">
            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 animate-pulse min-h-[380px] shadow-2xs flex flex-col justify-between">
              <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="my-4 flex-1 bg-gray-50/60 dark:bg-[#111111] rounded-lg min-h-[200px]" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-12 rounded bg-gray-50 dark:bg-[#111111]" />
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-3">
            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 animate-pulse min-h-[380px] shadow-2xs">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((k) => (
                  <div key={k} className="h-10 rounded bg-gray-50 dark:bg-[#111111]" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-md p-4">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold">Failed to load dashboard</p>
          <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 data-loaded-content w-full min-w-0 max-w-full">
      {/* ── 1. Top Summary KPI Cards (3 Multi-Layer Containers) ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 w-full min-w-0 max-w-full">
        {/* Container 1: TOTAL STUDENTS & OVERALL HIGH RISK STUDENTS (2 Layers) */}
        <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
          <Link
            to={studentPath}
            className="flex-1 flex items-center justify-between px-3.5 py-2 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              TOTAL STUDENTS
            </p>
            <p className="text-base sm:text-lg font-extrabold tracking-tight text-gray-900 dark:text-slate-100 shrink-0">
              {totalStudentsCount.toLocaleString()}
            </p>
          </Link>
          <Link
            to={studentPath}
            className="flex-1 flex items-center justify-between px-3.5 py-2 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              OVERALL HIGH RISK STUDENTS
            </p>
            <p className="text-base sm:text-lg font-extrabold text-risk-high shrink-0">
              {highRiskStudents.length.toLocaleString()}
            </p>
          </Link>
        </div>

        {/* Container 2: TUTORS, FACULTY, PRINCIPAL, & ADMIN (4 Layers) */}
        <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
          <Link
            to={user?.is_superuser ? "/superadmin/tutors" : "/admin/tutors"}
            className="flex-1 flex items-center justify-between px-3.5 py-1 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              TUTORS
            </p>
            <p className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 shrink-0">
              {totalTutorsCount.toLocaleString()}
            </p>
          </Link>
          <Link
            to={user?.is_superuser ? "/superadmin/faculty" : "/admin/faculty"}
            className="flex-1 flex items-center justify-between px-3.5 py-1 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              FACULTY
            </p>
            <p className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 shrink-0">
              {totalFacultyCount.toLocaleString()}
            </p>
          </Link>
          <Link
            to={user?.is_superuser ? "/superadmin/principals" : "/admin/principals"}
            className="flex-1 flex items-center justify-between px-3.5 py-1 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              PRINCIPAL
            </p>
            <p className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 shrink-0">
              {totalPrincipalsCount.toLocaleString()}
            </p>
          </Link>
          <Link
            to={user?.is_superuser ? "/superadmin/admins" : "/admin/admins"}
            className="flex-1 flex items-center justify-between px-3.5 py-1 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              ADMIN
            </p>
            <p className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 shrink-0">
              {totalAdminsCount.toLocaleString()}
            </p>
          </Link>
        </div>

        {/* Container 3: OVERALL AVERAGE ATTENDANCE, OVERALL AVERAGE SCORE, OVERALL COMPOSITE SCORE (3 Layers) */}
        <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
          <Link
            to={attendancePath}
            className="flex-1 flex items-center justify-between px-3.5 py-1.5 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              OVERALL AVERAGE ATTENDANCE
            </p>
            <p
              className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                !hasAttendanceData
                  ? 'text-gray-400 dark:text-slate-500'
                  : overallAttendanceRate >= 81
                  ? 'text-risk-low'
                  : overallAttendanceRate >= 75
                  ? 'text-risk-medium'
                  : 'text-risk-high'
              }`}
            >
              {!hasAttendanceData ? '—' : `${overallAttendanceRate}%`}
            </p>
          </Link>
          <Link
            to={evaluationPath}
            className="flex-1 flex items-center justify-between px-3.5 py-1.5 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              OVERALL AVERAGE SCORE
            </p>
            <p
              className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                !hasScoreData
                  ? 'text-gray-400 dark:text-slate-500'
                  : overallAvgScore >= 81
                  ? 'text-risk-low'
                  : overallAvgScore >= 75
                  ? 'text-risk-medium'
                  : 'text-risk-high'
              }`}
            >
              {!hasScoreData ? '—' : `${overallAvgScore}%`}
            </p>
          </Link>
          <Link
            to={evaluationPath}
            className="flex-1 flex items-center justify-between px-3.5 py-1.5 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-[var(--brand)] min-w-0"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              OVERALL COMPOSITE SCORE
            </p>
            <p
              className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                overallCompositeScore === 0
                  ? 'text-gray-400 dark:text-slate-500'
                  : overallCompositeScore >= 81
                  ? 'text-risk-low'
                  : overallCompositeScore >= 75
                  ? 'text-risk-medium'
                  : 'text-risk-high'
              }`}
            >
              {overallCompositeScore > 0 ? `${overallCompositeScore}%` : '—'}
            </p>
          </Link>
        </div>
      </div>

      {/* ── 3. Main Section: Trend Chart (Left) & Tutor Assessment Status (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch w-full min-w-0 max-w-full">
        {/* ── Left Column (9 cols on lg & xl: ~75% width): PNAHS ARAL PERFORMANCE TREND CHART ── */}
        <div className="lg:col-span-9 xl:col-span-9 flex flex-col gap-3 w-full min-w-0 max-w-full">
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-3.5 sm:p-4 flex flex-col flex-1 w-full min-w-0 max-w-full shadow-2xs">
            {/* ── Row 1: Card Title & Period Toggles (Full width, never truncates title) ── */}
            <div className="flex items-center justify-between gap-3 shrink-0 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight">
                  {selectedTutorObj
                    ? `${(selectedTutorObj.first_name || selectedTutorObj.full_name?.split(' ')[0] || '').trim().toUpperCase()}'S STUDENTS PERFORMANCE TREND`
                    : 'PNAHS ARAL PERFORMANCE TREND'}
                </h3>
              </div>

              {/* Period Toggles (DAY / WEEK / MONTH) */}
              <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
                {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTrendFilter(filter)}
                    className={`rounded-sm px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                      trendFilter === filter
                        ? 'bg-[var(--brand)] text-white shadow-xs'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Row 2: Filter Controls Bar (No 'Filters:' label, generous width to avoid truncation) ── */}
            <div className="flex items-center gap-2 pt-2.5 pb-1 flex-wrap w-full">
              {/* Tutor Filter Dropdown */}
              <select
                aria-label="Filter by Tutor Class"
                value={selectedTutorId}
                onChange={(e) => setSelectedTutorId(e.target.value)}
                className="h-8 px-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 cursor-pointer outline-none focus:border-[var(--brand)] min-w-[130px] flex-1 max-w-[200px]"
              >
                <option value="all">ALL TUTORS</option>
                {[...tutors]
                  .sort((a, b) => {
                    const nameA = (a.full_name || `${a.first_name} ${a.last_name}`).trim().toUpperCase();
                    const nameB = (b.full_name || `${b.first_name} ${b.last_name}`).trim().toUpperCase();
                    return nameA.localeCompare(nameB);
                  })
                  .map((tutor) => {
                    const fullName = (tutor.full_name || `${tutor.first_name} ${tutor.last_name}`).trim().toUpperCase();
                    return (
                      <option key={tutor.id} value={tutor.id}>
                        {fullName}
                      </option>
                    );
                  })}
              </select>

              {/* ARAL Level Filter Dropdown */}
              <select
                aria-label="Filter by ARAL Level"
                value={selectedAralLevel}
                onChange={(e) => setSelectedAralLevel(e.target.value)}
                className="h-8 px-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 cursor-pointer outline-none focus:border-[var(--brand)] min-w-[130px] flex-1 max-w-[170px]"
              >
                <option value="all">ALL ARAL LEVELS</option>
                {chartAralLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.label}
                  </option>
                ))}
              </select>

              {/* Subject Filter Dropdown */}
              <select
                aria-label="Filter by Subject"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="h-8 px-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 cursor-pointer outline-none focus:border-[var(--brand)] min-w-[125px] flex-1 max-w-[160px]"
              >
                <option value="all">ALL SUBJECTS</option>
                {chartSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.label}
                  </option>
                ))}
              </select>

              {/* Grade Level Filter Dropdown */}
              <select
                aria-label="Filter by Grade Level"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="h-8 px-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 cursor-pointer outline-none focus:border-[var(--brand)] min-w-[150px] flex-1 max-w-[180px]"
              >
                <option value="all">ALL GRADE LEVELS</option>
                {chartGrades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              {/* Section Filter Dropdown */}
              <select
                aria-label="Filter by Section"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="h-8 px-2 rounded-md text-[10px] sm:text-[11px] font-bold uppercase bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 cursor-pointer outline-none focus:border-[var(--brand)] min-w-[125px] flex-1 max-w-[160px]"
              >
                <option value="all">ALL SECTIONS</option>
                {chartSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Chart Canvas */}
            <div className="relative min-h-[220px] sm:min-h-[260px] flex-1 w-full mt-3 sm:mt-4 bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-lg px-2 py-2 sm:px-4 sm:py-3 overflow-hidden">
              {chartTrendData.length > 0 ? (
                <InteractiveAdminPerformanceChart data={chartTrendData} trendFilter={trendFilter} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                  <BarChart2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 whitespace-nowrap">
                    {trendFilter === 'day' ? 'No recorded score today' : trendFilter === 'week' ? 'No recorded score this week' : 'No recorded score this month'}
                  </p>
                  <p className="text-[11px] text-gray-300 dark:text-slate-600 whitespace-nowrap">
                    Data will appear once scores and attendance are logged for students
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              {[
                {
                  label: 'Highest',
                  value: chartTrendData.length === 0 ? '—' : `${highestScore}%`,
                  color: chartTrendData.length === 0 ? 'text-gray-400 dark:text-slate-500' : highestScore >= 81 ? 'text-risk-low' : highestScore >= 75 ? 'text-risk-medium' : 'text-risk-high',
                },
                {
                  label: 'Lowest',
                  value: chartTrendData.length === 0 ? '—' : `${lowestScore}%`,
                  color: chartTrendData.length === 0 ? 'text-gray-400 dark:text-slate-500' : lowestScore >= 81 ? 'text-risk-low' : lowestScore >= 75 ? 'text-risk-medium' : 'text-risk-high',
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide whitespace-nowrap truncate">{stat.label}</p>
                  <p className={`text-base sm:text-lg font-extrabold mt-0.5 whitespace-nowrap truncate ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
              <div className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide whitespace-nowrap truncate">Trend</p>
                <div className="mt-0.5 whitespace-nowrap truncate">
                  {chartTrendData.length === 0 ? (
                    <span className="text-base sm:text-lg font-extrabold text-gray-400 dark:text-slate-500 whitespace-nowrap">—</span>
                  ) : trendDir === 'up' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-low whitespace-nowrap">Improving</span>
                  ) : trendDir === 'down' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-high whitespace-nowrap">Declining</span>
                  ) : (
                    <span className="text-base sm:text-lg font-extrabold text-gray-500 dark:text-slate-400 whitespace-nowrap">Stable</span>
                  )}
                </div>
              </div>
              <Link
                to={evaluationPath}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-light)]/70 px-4 py-2.5 text-xs font-semibold text-[var(--brand)] dark:text-sky-400 transition hover:border-[var(--brand)] hover:bg-[var(--brand-light)] hover:text-[var(--brand-hover)] dark:hover:text-sky-300 whitespace-nowrap"
              >
                <span className="whitespace-nowrap">See More</span>
                <span className="font-bold" aria-hidden="true">&gt;</span>
              </Link>
            </div>
          </div>

          {/* ── Card 2: STAFF DTR ATTENDANCE RATE CHART ── */}
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-3.5 sm:p-4 flex flex-col flex-1 w-full min-w-0 max-w-full shadow-2xs">
            <div className="flex items-center justify-between gap-2 shrink-0 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight whitespace-nowrap truncate">
                  {staffChartTitle}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
                {/* Staff Filter Dropdown (All, Role groups, or Specific Tutor / Faculty / Admin) */}
                <select
                  aria-label="Filter Staff DTR Attendance"
                  value={selectedStaffFilter}
                  onChange={(e) => setSelectedStaffFilter(e.target.value)}
                  className="h-7 sm:h-8 px-1.5 sm:px-2 rounded-sm text-[10px] sm:text-[11px] font-bold uppercase bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-gray-700 dark:text-slate-300 cursor-pointer outline-none focus:border-[var(--brand)] max-w-[120px] xs:max-w-[160px] sm:max-w-[210px] whitespace-nowrap truncate shrink-0"
                >
                  <optgroup label="General">
                    <option value="all">ALL STAFF (TUTORS & FACULTY)</option>
                    <option value="role:tutor">ALL TUTORS</option>
                    <option value="role:faculty">ALL FACULTY</option>
                  </optgroup>
                  {staffTutors.length > 0 && (
                    <optgroup label="Tutors">
                      {staffTutors.map((t) => (
                        <option key={`staff-tutor-${t.id}`} value={`user:${t.id}`}>
                          {t.name.toUpperCase()} (TUTOR)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {staffFaculty.length > 0 && (
                    <optgroup label="Faculty">
                      {staffFaculty.map((f) => (
                        <option key={`staff-faculty-${f.id}`} value={`user:${f.id}`}>
                          {f.name.toUpperCase()} (FACULTY)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {staffAdmins.length > 0 && (
                    <optgroup label="Administrators">
                      {staffAdmins.map((ad) => (
                        <option key={`staff-admin-${ad.id}`} value={`user:${ad.id}`}>
                          {ad.name.toUpperCase()} (ADMIN)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Legend */}
                <div className="hidden xs:flex items-center gap-2 sm:gap-3 shrink-0 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-[var(--brand)] inline-block shrink-0" />
                    <span className="hidden sm:inline whitespace-nowrap">Attendance Rate</span>
                    <span className="sm:hidden whitespace-nowrap">Rate</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    <span className="h-0.5 w-3 border-b-2 border-dashed border-sky-400 inline-block shrink-0" />
                    <span className="whitespace-nowrap">80% Target</span>
                  </div>
                </div>

                {/* Period Toggles */}
                <div className="flex bg-gray-100 dark:bg-[#111111] rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap">
                  {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => (
                    <button
                      key={`staff-period-${filter}`}
                      type="button"
                      onClick={() => setStaffTrendFilter(filter)}
                      className={`rounded-sm px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                        staffTrendFilter === filter
                          ? 'bg-[var(--brand)] text-white shadow-xs'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="relative min-h-[220px] sm:min-h-[260px] flex-1 w-full mt-3 sm:mt-4 bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-lg px-2 py-2 sm:px-4 sm:py-3 overflow-hidden">
              {staffAttendanceTrendData.length > 0 ? (
                <InteractiveStaffAttendanceChart data={staffAttendanceTrendData} trendFilter={staffTrendFilter} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                  <BarChart2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 whitespace-nowrap">
                    {staffTrendFilter === 'day'
                      ? 'No staff DTR records today'
                      : staffTrendFilter === 'week'
                      ? 'No staff DTR records this week'
                      : 'No staff DTR records this month'}
                  </p>
                  <p className="text-[11px] text-gray-300 dark:text-slate-600 whitespace-nowrap">
                    Data will appear once tutors and faculty log their attendance
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
              {[
                {
                  label: 'Highest',
                  value: staffAttendanceTrendData.length === 0 ? '—' : `${highestStaffAttendance}%`,
                  color:
                    staffAttendanceTrendData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : highestStaffAttendance >= 80
                      ? 'text-risk-low'
                      : highestStaffAttendance >= 70
                      ? 'text-risk-medium'
                      : 'text-risk-high',
                },
                {
                  label: 'Lowest',
                  value: staffAttendanceTrendData.length === 0 ? '—' : `${lowestStaffAttendance}%`,
                  color:
                    staffAttendanceTrendData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : lowestStaffAttendance >= 80
                      ? 'text-risk-low'
                      : lowestStaffAttendance >= 70
                      ? 'text-risk-medium'
                      : 'text-risk-high',
                },
                {
                  label: 'Average',
                  value: staffAttendanceTrendData.length === 0 ? '—' : `${avgStaffAttendance}%`,
                  color:
                    staffAttendanceTrendData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : avgStaffAttendance >= 80
                      ? 'text-risk-low'
                      : avgStaffAttendance >= 70
                      ? 'text-risk-medium'
                      : 'text-risk-high',
                },
              ].map((stat) => (
                <div
                  key={`staff-metric-${stat.label}`}
                  className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center min-w-0"
                >
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide whitespace-nowrap truncate">
                    {stat.label}
                  </p>
                  <p className={`text-base sm:text-lg font-extrabold mt-0.5 whitespace-nowrap truncate ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
              <div className="bg-gray-50/80 dark:bg-[#111111] p-2.5 rounded-lg border border-gray-100 dark:border-[#1A1A1A] text-center flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide whitespace-nowrap truncate">
                  Trend
                </p>
                <div className="mt-0.5 whitespace-nowrap truncate">
                  {staffAttendanceTrendData.length === 0 ? (
                    <span className="text-base sm:text-lg font-extrabold text-gray-400 dark:text-slate-500 whitespace-nowrap">
                      —
                    </span>
                  ) : staffTrendDir === 'up' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-low whitespace-nowrap">
                      Improving
                    </span>
                  ) : staffTrendDir === 'down' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-high whitespace-nowrap">
                      Declining
                    </span>
                  ) : (
                    <span className="text-base sm:text-lg font-extrabold text-gray-500 dark:text-slate-400 whitespace-nowrap">
                      Stable
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column (3 cols on lg & xl: ~25% width): ASSESSMENT STATUS ── */}
        <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-3 w-full min-w-0 max-w-full">
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-3.5 sm:p-4 flex flex-col flex-1 h-full min-h-[420px] shadow-2xs">
            {/* Header */}
            <div className="pb-3 border-b border-gray-100 dark:border-[#1A1A1A] shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight">
                  ASSESSMENT STATUS
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border shrink-0 ${ratioBadgeClass}`}>
                  {conductedCount}/{tutors.length}
                </span>
              </div>
            </div>

            {/* Quick Search */}
            <div className="mt-3 relative w-full shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={tutorSearch}
                onChange={(e) => setTutorSearch(e.target.value)}
                placeholder="Search Tutor Name"
                className="w-full h-7.5 pl-8 pr-2.5 rounded-sm bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-xs text-gray-800 dark:text-slate-200 placeholder-gray-400 focus:outline-none focus:border-[var(--brand)]"
              />
            </div>

            {/* Tutors Status List */}
            <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
              {filteredTutorStatusList.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 dark:text-slate-500">
                  {tutors.length === 0 ? 'No tutors enrolled in ARAL Program' : 'No tutors matching search filter'}
                </div>
              ) : (
                filteredTutorStatusList.map((item) => {
                  const tutorName = item.tutor.full_name || `${item.tutor.first_name} ${item.tutor.last_name}`;

                  return (
                    <Link
                      key={item.tutor.id}
                      to={evaluationPath}
                      className="block p-2.5 rounded-md border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#111111]/70 hover:bg-gray-100/60 dark:hover:bg-white/[0.03] hover:border-gray-300 dark:hover:border-zinc-700 transition-colors group cursor-pointer shadow-2xs"
                      title={`View evaluation management for ${tutorName}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-900 dark:text-slate-100 group-hover:text-[var(--brand)] transition-colors truncate">
                            {tutorName}
                          </p>
                          <p className="text-[10.5px] text-gray-400 dark:text-slate-500 mt-0.5">
                            {item.assignedCount} assigned student{item.assignedCount === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold border shrink-0 ${item.badgeClass}`}
                        >
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
