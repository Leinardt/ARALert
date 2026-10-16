import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { academicService } from '../../services/academicService';
import { userService } from '../../services/userService';
import type { Attendance, Grade, PrincipalDashboardResponse, User } from '../../types';
import {
  BarChart2,
  AlertCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';
import {
  getActiveSystemMilestone,
  getActiveSystemSemester,
  SemesterType,
} from '../../utils/sessionDescriptionHelpers';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import {
  getChartAvailableAralLevels,
  getChartAvailableSubjects,
  getChartAvailableGrades,
  getChartAvailableSections,
  isStudentMatchingChartFilters,
} from '../../utils/tutorCohortHelpers';

// ─── Chart Types & Interactive Chart Component ─────────────────────────────────

interface PrincipalChartPoint {
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

const InteractivePrincipalPerformanceChart: React.FC<{
  data: PrincipalChartPoint[];
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
    // Day mode
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

  const getFormattedLabel = (p: PrincipalChartPoint) => {
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
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full block"
        role="img"
        aria-label="Performance Trend Chart"
      >
        <defs>
          <linearGradient id="principalChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="principalChartGlow" x="-20%" y="-30%" width="140%" height="160%">
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
            <path d={areaD} fill="url(#principalChartFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.28"
              filter="url(#principalChartGlow)"
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
              <circle cx={p.x} cy={p.y} r="8.5" fill="#38BDF8" opacity="0.45" filter="url(#principalChartGlow)" />
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
          <linearGradient id="staffAttendanceChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.01" />
          </linearGradient>
          <filter id="staffAttendanceGlow" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid lines and number labels (matching PNAHS ARAL Performance Trend Chart) */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = paddingTop + chartH - (val / 100) * chartH;
          return (
            <g key={`staff-grid-${val}`}>
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

        {/* 80% Benchmark Reference Line (Sky Blue Milestone Style) */}
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
              key={`staff-label-${idx}`}
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
            <path d={areaD} fill="url(#staffAttendanceChartFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.28"
              filter="url(#staffAttendanceGlow)"
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
            key={`staff-dot-${idx}`}
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
              key={`staff-hit-${idx}`}
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

// ─── Main PrincipalHome Component ──────────────────────────────────────────────

export const PrincipalHome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState<PrincipalDashboardResponse | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [tutorsList, setTutorsList] = useState<User[]>([]);
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

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [principalData, gradesData, attendanceData, studentsData, tutorsData, facultyData, adminsData] = await Promise.all([
        academicService.getPrincipalDashboard({ days: 30 }),
        academicService.getGrades().catch((err) => {
          console.warn('Could not load grades for principal dashboard:', err);
          return [] as Grade[];
        }),
        academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
        userService.getAllUsers({ role: 'student' }).catch(() => [] as User[]),
        userService.getTutors().catch(() => [] as User[]),
        userService.getAllUsers({ role: 'faculty' }).catch(() => [] as User[]),
        userService.getAllUsers({ role: 'admin' }).catch(() => [] as User[]),
      ]);

      setDashboardData(principalData);
      setGrades(Array.isArray(gradesData) ? gradesData : []);
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setTutorsList(Array.isArray(tutorsData) ? tutorsData : []);
      setFacultyList(Array.isArray(facultyData) ? facultyData : []);
      setAdminsList(Array.isArray(adminsData) ? adminsData : []);
    } catch (err: any) {
      console.error('PrincipalHome fetch error:', err);
      setError(err?.response?.data?.detail || 'Failed to load school administration dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    academicService
      .getCurrentSchoolYear()
      .then((sy) => {
        if (sy && sy.current_semester) {
          setActiveSystemSem(sy.current_semester as any);
        }
      })
      .catch(() => {});

    const handleSemChange = (e: any) => {
      const newSem = e?.detail?.semester || getActiveSystemSemester();
      setActiveSystemSem(newSem);
    };

    window.addEventListener('system_semester_changed', handleSemChange);
    return () => {
      window.removeEventListener('system_semester_changed', handleSemChange);
    };
  }, []);

  const adminMilestone = useMemo(() => {
    return getActiveSystemMilestone();
  }, [activeSystemSem]);

  // Tutors list from per_tutor_performance, tutorsList, and attendance records
  const tutors = useMemo(() => {
    const map = new Map<string, string>();
    (dashboardData?.per_tutor_performance || []).forEach((t) => {
      if (t.tutor_id) map.set(String(t.tutor_id), t.tutor_name);
    });
    tutorsList.forEach((t) => {
      const name = t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.username;
      if (t.id) map.set(String(t.id), name);
    });
    attendance.forEach((a) => {
      if ((a.role || '').toLowerCase() === 'tutor') {
        const id = String(a.user || a.tutor || '');
        const name = a.user_name || a.tutor_name || '';
        if (id && name && !map.has(id)) map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [dashboardData, tutorsList, attendance]);

  // Faculty list from facultyList and attendance records
  const faculty = useMemo(() => {
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

  // Administrators list from adminsList and attendance records
  const admins = useMemo(() => {
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

  const selectedTutorObj = useMemo(() => {
    if (selectedTutorId === 'all') return null;
    return tutors.find((t) => String(t.id) === String(selectedTutorId)) || null;
  }, [tutors, selectedTutorId]);

  const selectedTutorUser = useMemo(() => {
    if (selectedTutorId === 'all') return null;
    return tutorsList.find((t) => String(t.id) === String(selectedTutorId)) || null;
  }, [tutorsList, selectedTutorId]);

  // Dynamic filter choices adjusting to the selected tutor and parent filters
  const chartAralLevels = useMemo(() => {
    return getChartAvailableAralLevels(selectedTutorUser);
  }, [selectedTutorUser]);

  const chartSubjects = useMemo(() => {
    return getChartAvailableSubjects(selectedTutorUser, selectedAralLevel);
  }, [selectedTutorUser, selectedAralLevel]);

  const chartGrades = useMemo(() => {
    return getChartAvailableGrades(selectedTutorUser, students);
  }, [selectedTutorUser, students]);

  const chartSections = useMemo(() => {
    return getChartAvailableSections(selectedTutorUser, selectedGrade, students);
  }, [selectedTutorUser, selectedGrade, students]);

  // Auto-reset filters if their selection is no longer valid for the active tutor or parent filters
  useEffect(() => {
    if (selectedAralLevel !== 'all' && !chartAralLevels.some((l) => l.id === selectedAralLevel)) {
      setSelectedAralLevel('all');
    }
  }, [selectedAralLevel, chartAralLevels]);

  useEffect(() => {
    if (selectedSubject !== 'all' && !chartSubjects.some((s) => s.id === selectedSubject)) {
      setSelectedSubject('all');
    }
  }, [selectedSubject, chartSubjects]);

  useEffect(() => {
    if (selectedGrade !== 'all' && !chartGrades.includes(selectedGrade)) {
      setSelectedGrade('all');
    }
  }, [selectedGrade, chartGrades]);

  useEffect(() => {
    if (selectedSection !== 'all' && !chartSections.includes(selectedSection)) {
      setSelectedSection('all');
    }
  }, [selectedSection, chartSections]);

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
      const t = tutors.find((x) => String(x.id) === uid);
      if (t) return `${t.name.toUpperCase()}'S DTR ATTENDANCE RATE`;
      const f = faculty.find((x) => String(x.id) === uid);
      if (f) return `${f.name.toUpperCase()}'S DTR ATTENDANCE RATE`;
      const ad = admins.find((x) => String(x.id) === uid);
      if (ad) return `${ad.name.toUpperCase()}'S DTR ATTENDANCE RATE`;
    }
    return 'STAFF DTR ATTENDANCE RATE';
  }, [selectedStaffFilter, tutors, faculty, admins]);

  // ── Ranked Tutors for TOP PERFORMING CLASSES ──
  const [tutorSearch, setTutorSearch] = useState('');

  const rankedTutorClasses = useMemo(() => {
    const studentRiskRows = computeStudentRiskRows(students, grades, attendance);

    const tutorResults = tutors.map((tutor) => {
      const tutorIdStr = String(tutor.id);

      // Find students assigned to this tutor
      const assignedStudents = studentRiskRows.filter((r) => {
        const assigned = (r.student as any).assigned_tutor;
        const assignedId =
          typeof assigned === 'object' && assigned !== null
            ? String(assigned.id ?? assigned.pk ?? '')
            : String(assigned ?? '');
        return assignedId === tutorIdStr;
      });

      let studentCount = assignedStudents.length;
      let compositeScore = 0;
      let attendanceRate = 0;
      let averageScore = 0;

      if (assignedStudents.length > 0) {
        const totalComp = assignedStudents.reduce((acc, s) => acc + s.compositeScore, 0);
        compositeScore = Math.round((totalComp / assignedStudents.length) * 10) / 10;

        const totalAtt = assignedStudents.reduce((acc, s) => acc + s.attendanceRate, 0);
        attendanceRate = Math.round((totalAtt / assignedStudents.length) * 10) / 10;

        const totalSc = assignedStudents.reduce((acc, s) => acc + s.scoreAvg, 0);
        averageScore = Math.round((totalSc / assignedStudents.length) * 10) / 10;
      } else {
        // Fallback to per_tutor_performance trend points if direct student records aren't loaded
        const tutorTrend =
          dashboardData?.per_tutor_performance?.find((t) => String(t.tutor_id) === tutorIdStr)?.trend || [];
        const validPoints = tutorTrend.filter((p) => p.attendance_rate > 0 || p.average_score > 0);
        if (validPoints.length > 0) {
          const avgAtt = validPoints.reduce((acc, p) => acc + p.attendance_rate, 0) / validPoints.length;
          const avgSc = validPoints.reduce((acc, p) => acc + p.average_score, 0) / validPoints.length;
          attendanceRate = Math.round(avgAtt * 10) / 10;
          averageScore = Math.round(avgSc * 10) / 10;
          compositeScore = Math.round(((attendanceRate * 0.4) + (averageScore * 0.6)) * 10) / 10;
        }
      }

      return {
        tutorId: tutorIdStr,
        tutorName: tutor.name,
        studentCount,
        compositeScore,
        attendanceRate,
        averageScore,
      };
    });

    // Sort descending by compositeScore, secondary by averageScore, tertiary alphabetically
    tutorResults.sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) {
        return b.compositeScore - a.compositeScore;
      }
      if (b.averageScore !== a.averageScore) {
        return b.averageScore - a.averageScore;
      }
      return a.tutorName.localeCompare(b.tutorName);
    });

    return tutorResults.map((t, idx) => ({
      ...t,
      rank: idx + 1,
    }));
  }, [tutors, students, grades, attendance, dashboardData]);

  const filteredRankedTutors = useMemo(() => {
    if (!tutorSearch.trim()) return rankedTutorClasses;
    const query = tutorSearch.toLowerCase().trim();
    return rankedTutorClasses.filter((t) => t.tutorName.toLowerCase().includes(query));
  }, [rankedTutorClasses, tutorSearch]);

  // ── Metrics Calculations ──
  const totalStudentsCount = dashboardData?.program_summary.total_students ?? 0;
  const highRiskStudentsCount = dashboardData?.risk_summary.high ?? 0;
  const totalTutorsCount = dashboardData?.program_summary.total_tutors ?? 0;
  const totalFacultyCount = dashboardData?.program_summary.total_faculty ?? 0;

  const hasAttendanceData = useMemo(() => {
    if (attendance.length > 0) return true;
    return (dashboardData?.class_performance_trend || []).some((p) => p.attendance_rate > 0);
  }, [attendance, dashboardData]);

  const hasScoreData = useMemo(() => {
    if (grades.some((g) => g.component_type !== 'attendance')) return true;
    return (dashboardData?.class_performance_trend || []).some((p) => p.average_score > 0);
  }, [grades, dashboardData]);

  const overallAttendanceRate = useMemo(() => {
    if (attendance.length > 0) {
      const studentAtt = attendance.filter((a) => a.role === 'student' || (!a.role && a.status));
      if (studentAtt.length > 0) {
        const present = studentAtt.filter((a) => a.status === 'present').length;
        return Math.round((present / studentAtt.length) * 1000) / 10;
      }
    }
    const validPoints = (dashboardData?.class_performance_trend || []).filter((p) => p.attendance_rate > 0);
    if (validPoints.length > 0) {
      return Math.round((validPoints.reduce((acc, p) => acc + p.attendance_rate, 0) / validPoints.length) * 10) / 10;
    }
    return 0;
  }, [attendance, dashboardData]);

  const overallAvgScore = useMemo(() => {
    if (grades.length > 0) {
      const validScores = grades.filter((g) => g.score !== null && g.score !== undefined && g.component_type !== 'attendance');
      if (validScores.length > 0) {
        const total = validScores.reduce((sum, g) => {
          const scorePercent = g.total_score && g.total_score > 0 ? (g.score / g.total_score) * 100 : g.score;
          return sum + scorePercent;
        }, 0);
        return Math.round((total / validScores.length) * 10) / 10;
      }
    }
    const validPoints = (dashboardData?.class_performance_trend || []).filter((p) => p.average_score > 0);
    if (validPoints.length > 0) {
      return Math.round((validPoints.reduce((acc, p) => acc + p.average_score, 0) / validPoints.length) * 10) / 10;
    }
    return 0;
  }, [grades, dashboardData]);

  const overallCompositeScore = useMemo(() => {
    if (overallAttendanceRate > 0 && overallAvgScore > 0) {
      return Math.round(((overallAttendanceRate * 0.4) + (overallAvgScore * 0.6)) * 10) / 10;
    }
    if (overallAttendanceRate > 0) return overallAttendanceRate;
    if (overallAvgScore > 0) return overallAvgScore;
    return 0;
  }, [overallAttendanceRate, overallAvgScore]);

  // ── Compute performance trend data matching Admin ──
  const chartTrendData = useMemo<PrincipalChartPoint[]>(() => {
    if (students.length > 0 && filteredStudents.length === 0) return [];

    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const assessmentGrades = grades.filter((g) => {
      const gStudent = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
      const gStudentId = (g as any).student_id;
      const matchesStudent = studentIds.size > 0 ? (studentIds.has(String(gStudent)) || studentIds.has(String(gStudentId))) : true;
      const matchesTutor = selectedTutorId === 'all' || String(g.tutor) === String(selectedTutorId);
      if (!matchesStudent || !matchesTutor) return false;

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
          scores: [] as number[],
          attendanceCount: 0,
          assessmentLabels: new Set<string>(),
        };
      });
    }

    if (assessmentGrades.length > 0) {
      assessmentGrades.forEach((g) => {
        const dateStr = g.date_logged ? g.date_logged.slice(0, 10) : '';
        if (!dateStr) return;
        const gDate = new Date(`${dateStr}T00:00:00`);
        if (isNaN(gDate.getTime())) return;
        for (const p of periods) {
          if (gDate >= p.start && gDate < p.end) {
            const scorePercent = g.total_score && g.total_score > 0 ? (g.score / g.total_score) * 100 : g.score;
            p.scores.push(scorePercent);
            const assessmentText = `${g.subject} ${g.remarks ?? ''}`.toUpperCase();
            if (assessmentText.includes(adminMilestone.toUpperCase())) {
              p.assessmentLabels.add(adminMilestone);
            }
          }
        }
      });

      attendance.forEach((a) => {
        if (!a.date) return;
        const aUser = typeof a.user === 'object' && a.user !== null ? (a.user as any).id : a.user;
        const aUserId = (a as any).user_id || (a as any).student_id;
        if (studentIds.size > 0 && !studentIds.has(String(aUser)) && !studentIds.has(String(aUserId))) return;
        const aDate = new Date(`${a.date}T00:00:00`);
        if (isNaN(aDate.getTime())) return;
        for (const p of periods) {
          if (aDate >= p.start && aDate < p.end) {
            p.attendanceCount++;
          }
        }
      });

      return periods.map((p) => {
        const scoreAvg = p.scores.length > 0 ? p.scores.reduce((sum, s) => sum + s, 0) / p.scores.length : 0;
        const composite = scoreAvg > 0 ? Math.round(scoreAvg * 10) / 10 : 0;
        return {
          label: p.label,
          fullDateLabel: p.fullDateLabel,
          dateRange: p.dateRange,
          value: composite,
          actualCount: p.scores.length,
          attendanceCount: p.attendanceCount,
          assessmentLabels: Array.from(p.assessmentLabels),
        };
      });
    }

    // Fallback if grades aren't populated: project from dashboardData.class_performance_trend
    const trendPoints =
      selectedTutorId !== 'all'
        ? dashboardData?.per_tutor_performance?.find((t) => t.tutor_id === selectedTutorId)?.trend ?? []
        : dashboardData?.class_performance_trend ?? [];

    if (trendPoints.length === 0) return [];

    return trendPoints.slice(-10).map((pt) => {
      const d = new Date(pt.date);
      const label = isNaN(d.getTime()) ? pt.date : formatDate(d);
      const scoreVal = pt.average_score || 0;
      const attVal = pt.attendance_rate || 0;
      const compositeVal = scoreVal > 0 && attVal > 0
        ? Math.round((attVal * 0.4 + scoreVal * 0.6) * 10) / 10
        : scoreVal > 0
        ? scoreVal
        : attVal;

      return {
        label,
        fullDateLabel: isNaN(d.getTime()) ? pt.date : d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        dateRange: pt.date,
        value: Math.round(compositeVal * 10) / 10,
        actualCount: scoreVal > 0 ? 1 : 0,
        attendanceCount: attVal > 0 ? 1 : 0,
        assessmentLabels: [],
      };
    });
  }, [grades, attendance, selectedTutorId, selectedSubject, trendFilter, adminMilestone, dashboardData, filteredStudents, students]);

  // High/Low score calculations
  const numericScores = useMemo(
    () => chartTrendData.map((d) => d.value).filter((v) => v > 0),
    [chartTrendData]
  );
  const highestScore = numericScores.length > 0 ? Math.max(...numericScores) : 0;
  const lowestScore = numericScores.length > 0 ? Math.min(...numericScores) : 0;

  const trendDir = useMemo(() => {
    if (chartTrendData.length < 2) return 'neutral';
    const nonZero = chartTrendData.filter((d) => d.value > 0);
    if (nonZero.length < 2) return 'neutral';
    const first = nonZero[0].value;
    const last = nonZero[nonZero.length - 1].value;
    if (last > first + 2) return 'up';
    if (last < first - 2) return 'down';
    return 'neutral';
  }, [chartTrendData]);

  // ── Staff DTR Attendance Trend Data & Metrics ────────────────────────────────
  const staffAttendanceTrendData = useMemo<StaffAttendanceChartPoint[]>(() => {
    const isTargetStaffLog = (a: Attendance) => {
      const r = (a.role || '').toLowerCase();
      if (r === 'student') return false;

      const userIdStr = String(a.user || (a as any).user_id || a.tutor || '');

      if (selectedStaffFilter === 'all') {
        return (
          ['tutor', 'faculty', 'admin', 'principal'].includes(r) ||
          tutors.some((t) => String(t.id) === userIdStr) ||
          faculty.some((f) => String(f.id) === userIdStr) ||
          admins.some((ad) => String(ad.id) === userIdStr)
        );
      }
      if (selectedStaffFilter === 'role:tutor') {
        return r === 'tutor' || tutors.some((t) => String(t.id) === userIdStr);
      }
      if (selectedStaffFilter === 'role:faculty') {
        return r === 'faculty' || faculty.some((f) => String(f.id) === userIdStr);
      }
      if (selectedStaffFilter === 'role:admin') {
        return r === 'admin' || admins.some((ad) => String(ad.id) === userIdStr);
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

    const hasAnyLog = periods.some((p) => p.totalCount > 0);

    // Fallback to backend staff_attendance_trend if direct attendance records are empty
    if (!hasAnyLog && (dashboardData?.staff_attendance_trend || []).length > 0) {
      const backendTrends = dashboardData?.staff_attendance_trend || [];
      return periods.map((p) => {
        const matchingPoints = backendTrends.filter((pt) => {
          const ptDate = new Date(`${pt.date}T00:00:00`);
          return !isNaN(ptDate.getTime()) && ptDate >= p.start && ptDate < p.end;
        });

        let rate = 0;
        if (matchingPoints.length > 0) {
          if (selectedStaffFilter === 'role:tutor') {
            const sum = matchingPoints.reduce((acc, pt) => acc + (pt.tutor_attendance_rate || 0), 0);
            rate = Math.round((sum / matchingPoints.length) * 10) / 10;
          } else if (selectedStaffFilter === 'role:faculty') {
            const sum = matchingPoints.reduce((acc, pt) => acc + (pt.faculty_attendance_rate || 0), 0);
            rate = Math.round((sum / matchingPoints.length) * 10) / 10;
          } else {
            const sum = matchingPoints.reduce(
              (acc, pt) => acc + ((pt.tutor_attendance_rate || 0) + (pt.faculty_attendance_rate || 0)) / 2,
              0
            );
            rate = Math.round((sum / matchingPoints.length) * 10) / 10;
          }
        }

        return {
          label: p.label,
          fullDateLabel: p.fullDateLabel,
          dateRange: p.dateRange,
          value: rate,
          presentCount: matchingPoints.length > 0 && rate > 0 ? 1 : 0,
          totalCount: matchingPoints.length,
        };
      });
    }

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
  }, [attendance, selectedStaffFilter, staffTrendFilter, tutors, faculty, admins, dashboardData]);

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
          {/* Card 2 Skeleton: 2 layers (Tutors, Faculty) */}
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] animate-pulse divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-2xs">
            {[1, 2].map((i) => (
              <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-2">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-5 w-8 rounded bg-gray-200 dark:bg-gray-800" />
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
            {/* Chart 1 Skeleton: Performance Trend */}
            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 animate-pulse min-h-[380px] shadow-2xs flex flex-col justify-between">
              <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="my-4 flex-1 bg-gray-50/60 dark:bg-[#111111] rounded-lg min-h-[200px]" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-12 rounded bg-gray-50 dark:bg-[#111111]" />
                ))}
              </div>
            </div>
            {/* Chart 2 Skeleton: Staff DTR Attendance */}
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
            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 animate-pulse min-h-[600px] lg:min-h-full h-full shadow-2xs flex flex-col justify-between">
              <div>
                <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((k) => (
                    <div key={k} className="h-12 rounded bg-gray-50 dark:bg-[#111111]" />
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 dark:border-[#1A1A1A] h-8 rounded bg-gray-50 dark:bg-[#111111]" />
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
            onClick={loadDashboard}
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
          <div className="flex-1 flex items-center justify-between px-3.5 py-2 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              TOTAL STUDENTS
            </p>
            <p className="text-base sm:text-lg font-extrabold tracking-tight text-gray-900 dark:text-slate-100 shrink-0">
              {totalStudentsCount.toLocaleString()}
            </p>
          </div>
          <div className="flex-1 flex items-center justify-between px-3.5 py-2 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              OVERALL HIGH RISK STUDENTS
            </p>
            <p className="text-base sm:text-lg font-extrabold text-risk-high shrink-0">
              {highRiskStudentsCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Container 2: TUTORS & FACULTY (2 Layers — Admin, Superadmin & Principal removed) */}
        <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
          <div className="flex-1 flex items-center justify-between px-3.5 py-2 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              TUTORS
            </p>
            <p className="text-base sm:text-lg font-extrabold tracking-tight text-gray-900 dark:text-slate-100 shrink-0">
              {totalTutorsCount.toLocaleString()}
            </p>
          </div>
          <div className="flex-1 flex items-center justify-between px-3.5 py-2 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              FACULTY
            </p>
            <p className="text-base sm:text-lg font-extrabold tracking-tight text-gray-900 dark:text-slate-100 shrink-0">
              {totalFacultyCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Container 3: OVERALL AVERAGE ATTENDANCE, OVERALL AVERAGE SCORE, OVERALL COMPOSITE SCORE (3 Layers) */}
        <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-2xs">
          <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
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
          </div>
          <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
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
          </div>
          <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
              OVERALL COMPOSITE SCORE
            </p>
            <p
              className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                !hasAttendanceData && !hasScoreData
                  ? 'text-gray-400 dark:text-slate-500'
                  : overallCompositeScore >= 81
                  ? 'text-risk-low'
                  : overallCompositeScore >= 75
                  ? 'text-risk-medium'
                  : 'text-risk-high'
              }`}
            >
              {!hasAttendanceData && !hasScoreData ? '—' : `${overallCompositeScore}%`}
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Main Section: Trend Chart (Left) & Top Performing Classes (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch w-full min-w-0 max-w-full">
        {/* ── Left Column (9 cols on lg & xl: ~75% width): Performance Trend Chart ── */}
        <div className="lg:col-span-9 xl:col-span-9 flex flex-col gap-3 w-full min-w-0 max-w-full">
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-3.5 sm:p-4 flex flex-col flex-1 w-full min-w-0 max-w-full shadow-2xs">
            {/* ── Row 1: Card Title & Period Toggles (Full width, never truncates title) ── */}
            <div className="flex items-center justify-between gap-3 shrink-0 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--brand)] inline-block shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight">
                  {selectedTutorObj
                    ? `${selectedTutorObj.name.toUpperCase()}'S STUDENTS PERFORMANCE TREND`
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
                {tutors.map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>
                    {tutor.name.toUpperCase()}
                  </option>
                ))}
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
                <InteractivePrincipalPerformanceChart data={chartTrendData} trendFilter={trendFilter} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
                  <BarChart2 className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 whitespace-nowrap">
                    {trendFilter === 'day'
                      ? 'No recorded score today'
                      : trendFilter === 'week'
                      ? 'No recorded score this week'
                      : 'No recorded score this month'}
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
                  color:
                    chartTrendData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : highestScore >= 81
                      ? 'text-risk-low'
                      : highestScore >= 75
                      ? 'text-risk-medium'
                      : 'text-risk-high',
                },
                {
                  label: 'Lowest',
                  value: chartTrendData.length === 0 ? '—' : `${lowestScore}%`,
                  color:
                    chartTrendData.length === 0
                      ? 'text-gray-400 dark:text-slate-500'
                      : lowestScore >= 81
                      ? 'text-risk-low'
                      : lowestScore >= 75
                      ? 'text-risk-medium'
                      : 'text-risk-high',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
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
                  {chartTrendData.length === 0 ? (
                    <span className="text-base sm:text-lg font-extrabold text-gray-400 dark:text-slate-500 whitespace-nowrap">
                      —
                    </span>
                  ) : trendDir === 'up' ? (
                    <span className="text-base sm:text-lg font-extrabold text-risk-low whitespace-nowrap">
                      Improving
                    </span>
                  ) : trendDir === 'down' ? (
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
              <Link
                to="/principal/analytics"
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
                  {tutors.length > 0 && (
                    <optgroup label="Tutors">
                      {tutors.map((t) => (
                        <option key={`staff-tutor-${t.id}`} value={`user:${t.id}`}>
                          {t.name.toUpperCase()} (TUTOR)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {faculty.length > 0 && (
                    <optgroup label="Faculty">
                      {faculty.map((f) => (
                        <option key={`staff-faculty-${f.id}`} value={`user:${f.id}`}>
                          {f.name.toUpperCase()} (FACULTY)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {admins.length > 0 && (
                    <optgroup label="Administrators">
                      {admins.map((ad) => (
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

        {/* ── Right Column (3 cols on lg & xl: ~25% width): TOP PERFORMING CLASSES ── */}
        <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-3 w-full min-w-0 max-w-full">
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-3.5 sm:p-4 flex flex-col flex-1 h-full min-h-[600px] lg:min-h-full shadow-2xs">
            {/* Header */}
            <div className="pb-3 border-b border-gray-100 dark:border-[#1A1A1A] shrink-0 flex items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight truncate">
                TOP PERFORMING CLASSES
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-[#262626] shrink-0">
                {filteredRankedTutors.length} {filteredRankedTutors.length === 1 ? 'Class' : 'Classes'}
              </span>
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

            {/* Ranked Tutors List */}
            <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 max-h-[700px] lg:max-h-none">
              {filteredRankedTutors.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 dark:text-slate-500">
                  {rankedTutorClasses.length === 0 ? 'No tutor classes found' : 'No tutors matching search filter'}
                </div>
              ) : (
                filteredRankedTutors.map((item) => {
                  const rankBadgeClass =
                    item.rank === 1
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300/80 dark:border-amber-700/60'
                      : item.rank === 2
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      : item.rank === 3
                      ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border-orange-300/80 dark:border-orange-700/60'
                      : 'bg-gray-100 dark:bg-[#181818] text-gray-500 dark:text-slate-400 border-gray-200 dark:border-[#222222]';

                  return (
                    <div
                      key={item.tutorId}
                      onClick={() => navigate(`/principal/analytics?tutorId=${item.tutorId}`)}
                      className="block p-2.5 rounded-md border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#111111]/70 hover:bg-gray-100/60 dark:hover:bg-white/[0.03] hover:border-gray-300 dark:hover:border-zinc-700 transition-colors group cursor-pointer shadow-2xs"
                      title={`Click to view data analytics for ${item.tutorName}`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-extrabold border shrink-0 ${rankBadgeClass}`}
                          >
                            #{item.rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-900 dark:text-slate-100 group-hover:text-[var(--brand)] transition-colors truncate">
                              {item.tutorName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400 dark:text-slate-500 truncate">
                              <span>{item.studentCount} stu</span>
                              <span>•</span>
                              <span>Att: {item.attendanceRate}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Composite Score Pill */}
                        <div className="text-right shrink-0">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-extrabold border ${
                              item.compositeScore === 0
                                ? 'text-gray-400 dark:text-slate-500 border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#111111]'
                                : item.compositeScore >= 81
                                ? 'text-risk-low border-emerald-200 bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-950/40'
                                : item.compositeScore >= 70
                                ? 'text-risk-medium border-amber-200 bg-amber-50 dark:border-amber-800/80 dark:bg-amber-950/40'
                                : 'text-risk-high border-rose-200 bg-rose-50 dark:border-rose-800/80 dark:bg-rose-950/40'
                            }`}
                          >
                            {item.compositeScore === 0 ? '—' : `${item.compositeScore}%`}
                          </span>
                          <p className="text-[8.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mt-0.5 text-right">
                            COMPOSITE
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer Info */}
            <div className="pt-3 mt-3 border-t border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500 shrink-0">
              <span className="truncate">Ranked by Composite Score</span>
              <Link
                to="/principal/analytics"
                className="font-bold text-[var(--brand)] dark:text-sky-400 hover:underline shrink-0 ml-2"
              >
                View Analytics &gt;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrincipalHome;
