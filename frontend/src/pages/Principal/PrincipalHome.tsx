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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getRecentSchoolWeekdays } from '../../utils/studentFormatters';
import {
  getActiveSystemMilestone,
  getActiveSystemSemester,
  SemesterType,
} from '../../utils/sessionDescriptionHelpers';
import { computeStudentRiskRows } from '../../utils/analyticsHelpers';
import { SlidingPeriodToggle } from '../../components/SlidingTabs';
import {
  getChartAvailableClasses,
  isStudentMatchingChartFilters,
  parseStudentGradeAndSection,
} from '../../utils/tutorCohortHelpers';
import { matchesSearch } from '../../utils/searchHelpers';
import { AnimatedCounter } from '../../components/AnimatedCounter';

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
    const shortM1 = m1.slice(0, 3);
    const shortM2 = m2.slice(0, 3);
    if (shortM1.toLowerCase() === shortM2.toLowerCase()) {
      return `${shortM1} ${d1}–${d2}`;
    }
    return `${shortM1} ${d1}–${shortM2} ${d2}`;
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
      if (rect.width > 0) {
        const minH = rect.width < 520 ? 196 : 220;
        setDimensions({
          width: Math.round(rect.width),
          height: Math.max(minH, Math.round(rect.height)),
        });
      }
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0) {
          const minH = width < 520 ? 196 : 220;
          setDimensions({
            width: Math.round(width),
            height: Math.max(minH, Math.round(height)),
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;
  const isMobile = width < 520;
  const paddingLeft = isMobile ? 38 : 50;
  const paddingRight = isMobile ? 18 : 44;
  const paddingTop = isMobile ? 16 : 20;
  const paddingBottom = isMobile ? (trendFilter === 'month' ? 24 : 34) : 24;

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

  const getMobileLabelLines = (label: string): [string, string?] => {
    if (trendFilter === 'week') {
      const parts = label.split(/\s*[–—\-]\s*/);
      if (parts.length === 2) {
        return [parts[0].trim(), `–${parts[1].trim()}`];
      }
      return [label];
    }
    if (trendFilter === 'day') {
      const parts = label.trim().split(/\s+/);
      if (parts.length >= 2) {
        return [parts[0], parts.slice(1).join(' ')];
      }
      return [label];
    }
    if (trendFilter === 'month') {
      return [label.split(' ')[0] || label];
    }
    return [label];
  };

  const chartAnimationKey = `principalHome_${trendFilter}_${points.length}_${points.map((p) => p.value).join('-')}`;

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full min-h-[196px] sm:min-h-[220px] select-none min-w-0 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full min-h-[196px] sm:min-h-[220px] block"
        role="img"
        aria-label="Performance Trend Chart"
      >
        <defs>
          <style>{`
            @keyframes traceLine {
              0% {
                stroke-dashoffset: 1000;
              }
              100% {
                stroke-dashoffset: 0;
              }
            }
            @keyframes revealArea {
              0% {
                opacity: 0;
              }
              30% {
                opacity: 0;
              }
              100% {
                opacity: 1;
              }
            }
            @keyframes popMarker {
              0% {
                opacity: 0;
                transform: scale(0);
              }
              70% {
                opacity: 0.95;
                transform: scale(1.3);
              }
              100% {
                opacity: 1;
                transform: scale(1);
              }
            }
            .chart-line-trace {
              stroke-dasharray: 1000;
              stroke-dashoffset: 1000;
              animation: traceLine 1.6s cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            .chart-area-reveal {
              opacity: 0;
              animation: revealArea 1.8s ease-out both;
            }
            .chart-marker-pop {
              transform-box: fill-box;
              transform-origin: center;
              opacity: 0;
              animation: popMarker 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            }
            @media (prefers-reduced-motion: reduce) {
              .chart-line-trace,
              .chart-area-reveal,
              .chart-marker-pop {
                animation: none !important;
                stroke-dashoffset: 0 !important;
                opacity: 1 !important;
                transform: none !important;
              }
            }
          `}</style>
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
                x={paddingLeft - 6}
                y={y + 3}
                className="fill-slate-400 font-semibold text-[8.5px] xs:text-[9.5px] sm:text-[10px]"
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

        {/* X-axis date labels (complete dates for every point matching Student/Tutor Home) */}
        {points.map((p, idx) => {
          if (isMobile) {
            const [line1, line2] = getMobileLabelLines(p.label);
            if (line2) {
              return (
                <text
                  key={`label-${idx}`}
                  x={p.x}
                  y={paddingTop + chartH + 13}
                  className="fill-slate-500 dark:fill-slate-400 font-semibold text-[8.5px] select-none"
                  textAnchor="middle"
                >
                  <tspan x={p.x} dy="0">{line1}</tspan>
                  <tspan x={p.x} dy="10">{line2}</tspan>
                </text>
              );
            }
            return (
              <text
                key={`label-${idx}`}
                x={p.x}
                y={height - 6}
                className="fill-slate-500 dark:fill-slate-400 font-semibold text-[9px] select-none"
                textAnchor="middle"
                style={{ whiteSpace: 'nowrap' }}
              >
                {line1}
              </text>
            );
          }

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
              y={height - 5}
              className="fill-slate-500 dark:fill-slate-400 font-semibold text-[10px] select-none"
              textAnchor={textAnchor}
              style={{ whiteSpace: 'nowrap' }}
            >
              {p.label}
            </text>
          );
        })}

        {/* Animated Brand Trend Line & Area */}
        <g key={chartAnimationKey}>
          {points.length > 0 && (
            <>
              <path d={areaD} fill="url(#principalChartFill)" className="chart-area-reveal" />
              <path
                pathLength={1000}
                d={pathD}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.28"
                filter="url(#principalChartGlow)"
                className="chart-line-trace"
              />
              <path
                pathLength={1000}
                d={pathD}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="chart-line-trace"
              />
            </>
          )}

          {/* Animated data point markers */}
          {points.map((p, idx) => (
            <circle
              key={`data-dot-${idx}`}
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="var(--brand)"
              stroke="#B6D4F8"
              strokeWidth="1.5"
              className="chart-marker-pop"
              style={{ animationDelay: `${Math.min(1.2, 0.4 + idx * 0.08)}s` }}
            />
          ))}
        </g>

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

// ─── Main PrincipalHome Component ──────────────────────────────────────────────

export const PrincipalHome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState<PrincipalDashboardResponse | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [tutorsList, setTutorsList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [trendFilter, setTrendFilter] = useState<TrendFilter>('week');
  const [trendPage, setTrendPage] = useState<number>(0);
  const [selectedTutorId, setSelectedTutorId] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [isTutorMenuOpen, setIsTutorMenuOpen] = useState(false);
  const [isClassMenuOpen, setIsClassMenuOpen] = useState(false);
  const tutorDropdownRef = useRef<HTMLDivElement>(null);
  const classDropdownRef = useRef<HTMLDivElement>(null);
  const [activeSystemSem, setActiveSystemSem] = useState<SemesterType>(() => getActiveSystemSemester());
  const [leftColHeight, setLeftColHeight] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
  const leftColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    const updateSize = () => {
      if (typeof window !== 'undefined') {
        setIsDesktop(window.innerWidth >= 1024);
      }
      if (leftColRef.current) {
        const h = leftColRef.current.offsetHeight;
        if (h > 0) setLeftColHeight(h);
      }
    };

    updateSize();
    animId = requestAnimationFrame(updateSize);
    const timeout = setTimeout(updateSize, 300);

    const ro = new ResizeObserver(updateSize);
    if (leftColRef.current) {
      ro.observe(leftColRef.current);
    }
    window.addEventListener('resize', updateSize);
    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timeout);
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isLoading]);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [principalData, gradesData, attendanceData, studentsData, tutorsData] = await Promise.all([
        academicService.getPrincipalDashboard({ days: 30 }),
        academicService.getGrades().catch((err) => {
          console.warn('Could not load grades for principal dashboard:', err);
          return [] as Grade[];
        }),
        academicService.getAttendanceHistory().catch(() => [] as Attendance[]),
        userService.getAllUsers({ role: 'student' }).catch(() => [] as User[]),
        userService.getAllUsers({ role: 'tutor' }).catch(() => [] as User[]),
      ]);

      setDashboardData(principalData);
      setGrades(Array.isArray(gradesData) ? gradesData : []);
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setTutorsList(Array.isArray(tutorsData) ? tutorsData : []);
    } catch (err: any) {
      console.error('PrincipalHome fetch error:', err);
      setError(err?.response?.data?.detail || 'Failed to load school administration dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (tutorDropdownRef.current && !tutorDropdownRef.current.contains(target)) {
        setIsTutorMenuOpen(false);
      }
      if (classDropdownRef.current && !classDropdownRef.current.contains(target)) {
        setIsClassMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

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
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboardData, tutorsList, attendance]);

  const selectedTutorObj = useMemo(() => {
    if (selectedTutorId === 'all') return null;
    return tutors.find((t) => String(t.id) === String(selectedTutorId)) || null;
  }, [tutors, selectedTutorId]);

  const selectedTutorUser = useMemo(() => {
    if (selectedTutorId === 'all') return null;
    return tutorsList.find((t) => String(t.id) === String(selectedTutorId)) || null;
  }, [tutorsList, selectedTutorId]);

  const selectedTutorLabel = useMemo(() => {
    if (selectedTutorId === 'all') return 'ALL TUTORS';
    const tutor = tutors.find((t) => String(t.id) === String(selectedTutorId));
    return tutor ? tutor.name.toUpperCase() : 'ALL TUTORS';
  }, [selectedTutorId, tutors]);

  const selectedClassLabel = useMemo(() => {
    if (selectedClass === 'all') return 'ALL CLASSES';
    return selectedClass;
  }, [selectedClass]);

  // Classes handled by the selected tutor (empty if all tutors selected, defaulting to all students)
  const chartClasses = useMemo(() => {
    if (!selectedTutorUser) return [];
    return getChartAvailableClasses(selectedTutorUser, students);
  }, [selectedTutorUser, students]);

  // When selected tutor changes, auto-reset class filter to default all students ('all')
  const prevTutorIdRef = useRef(selectedTutorId);
  useEffect(() => {
    if (prevTutorIdRef.current !== selectedTutorId) {
      prevTutorIdRef.current = selectedTutorId;
      setSelectedClass('all');
    }
  }, [selectedTutorId]);

  // Reset class filter if the currently selected class is not handled by the tutor
  useEffect(() => {
    if (selectedClass !== 'all' && !chartClasses.includes(selectedClass)) {
      setSelectedClass('all');
    }
  }, [selectedClass, chartClasses]);

  // Filter students based on selected tutor and class cohort
  const filteredStudents = useMemo(() => {
    return students.filter((s) =>
      isStudentMatchingChartFilters(s, {
        tutorId: selectedTutorId,
        aralLevel: 'all',
        subject: 'all',
        classCohort: selectedClass,
      })
    );
  }, [students, selectedTutorId, selectedClass]);

  // ── Ranked Tutors for TOP PERFORMING CLASSES ──
  const [tutorSearch, setTutorSearch] = useState('');

  const rankedTutorClasses = useMemo(() => {
    const studentRiskRows = computeStudentRiskRows(students, grades, attendance);

    const tutorResults = tutors.map((tutor) => {
      const tutorIdStr = String(tutor.id);

      // Find students assigned to this tutor
      const assignedStudents = studentRiskRows.filter((r) => {
        const assigned = (r.student as any).assigned_tutor;
        const assignedTutorId = (r.student as any).assigned_tutor_id;
        const assignedId =
          typeof assigned === 'object' && assigned !== null
            ? String(assigned.id ?? assigned.pk ?? '')
            : String(assigned ?? assignedTutorId ?? '');
        return assignedId === tutorIdStr;
      });

      let studentCount = assignedStudents.length;
      let compositeScore = 0;
      let attendanceRate = 0;
      let averageScore = 0;

      if (assignedStudents.length > 0) {
        const studentsWithAtt = assignedStudents.filter((s) => s.totalDays > 0);
        const studentsWithScores = assignedStudents.filter((s) => s.scoreCount > 0);

        if (studentsWithAtt.length > 0) {
          const totalAtt = studentsWithAtt.reduce((acc, s) => acc + s.attendanceRate, 0);
          attendanceRate = Math.round((totalAtt / studentsWithAtt.length) * 10) / 10;
        }

        if (studentsWithScores.length > 0) {
          const totalSc = studentsWithScores.reduce((acc, s) => acc + s.scoreAvg, 0);
          averageScore = Math.round((totalSc / studentsWithScores.length) * 10) / 10;
        }

        if (attendanceRate > 0 && averageScore > 0) {
          compositeScore = Math.round(((attendanceRate * 0.4) + (averageScore * 0.6)) * 10) / 10;
        } else if (attendanceRate > 0) {
          compositeScore = attendanceRate;
        } else if (averageScore > 0) {
          compositeScore = averageScore;
        }
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

      const tutorName =
        tutor.name ||
        (tutor as any).full_name ||
        `${(tutor as any).first_name || ''} ${(tutor as any).last_name || ''}`.trim() ||
        (tutor as any).username ||
        'Unknown Tutor';

      // Determine the class(es) handled by this tutor
      const tutorUser = tutorsList.find((tl) => String(tl.id) === tutorIdStr);
      const classesSet = new Set<string>();

      // 1. From assigned students
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

      // 2. Fallback to tutorUser metadata if no students assigned yet
      if (classesSet.size === 0 && tutorUser) {
        const available = getChartAvailableClasses(tutorUser, students);
        available.forEach((c) => classesSet.add(c));
        if (classesSet.size === 0 && tutorUser.grade_level) {
          tutorUser.grade_level.split(',').forEach((c) => {
            const trimmed = c.trim();
            if (trimmed) classesSet.add(trimmed);
          });
        }
      }

      const classesHandled =
        classesSet.size > 0
          ? Array.from(classesSet).sort().join(', ')
          : 'No Class Assigned';

      return {
        tutorId: tutorIdStr,
        tutorName,
        studentCount,
        classesHandled,
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
    return rankedTutorClasses.filter((t) =>
      matchesSearch(tutorSearch, t.tutorName) || matchesSearch(tutorSearch, t.classesHandled)
    );
  }, [rankedTutorClasses, tutorSearch]);

  // ── Metrics Calculations ──
  const totalStudentsCount = dashboardData?.program_summary.total_students ?? 0;
  const highRiskStudentsCount = dashboardData?.risk_summary.high ?? 0;
  const totalTutorsCount = dashboardData?.program_summary.total_tutors ?? 0;

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

  // ── Compute performance trend combining composite scores (matching Admin logic) ──
  const chartTrendData = useMemo<PrincipalChartPoint[]>(() => {
    if (filteredStudents.length === 0 || grades.length === 0) return [];
    const studentIds = new Set(filteredStudents.map((s) => String(s.id)));
    const assessmentGrades = grades.filter((g) => {
      const gStudent = typeof g.student === 'object' && g.student !== null ? (g.student as any).id : g.student;
      const gStudentId = (g as any).student_id;
      const matchesStudent = studentIds.has(String(gStudent)) || studentIds.has(String(gStudentId));
      if (!matchesStudent) return false;

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
      const count = 10 * (trendPage + 1);
      const allSchoolDays = getRecentSchoolWeekdays(count, now);
      const schoolDays = allSchoolDays.slice(0, 10);
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
        const totalOffset = (periodCount - 1 - index) + trendPage * periodCount;
        if (trendFilter === 'month') {
          start = new Date(now.getFullYear(), now.getMonth() - totalOffset, 1);
          end = new Date(now.getFullYear(), now.getMonth() - totalOffset + 1, 1);
          label = formatMonth(start);
          const monthFull = start.toLocaleDateString('en-US', { month: 'long' });
          const year = start.getFullYear();
          fullDateLabel = `${monthFull} ${year}`;
        } else {
          // week (Mon–Fri)
          const dayOfWeek = now.getDay();
          const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const currentWeekMon = new Date(startOfToday.getTime() + diffToMon * oneDay);
          start = new Date(currentWeekMon.getTime() - totalOffset * 7 * oneDay);
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
      const aUser = typeof att.user === 'object' && att.user !== null ? (att.user as any).id : att.user;
      const aUserId = (att as any).user_id || (att as any).student_id;
      if (!studentIds.has(String(aUser)) && !studentIds.has(String(aUserId))) return;
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

    if (points.every((p) => p.value === null)) {
      if (trendPage > 0) {
        return points.map((p) => ({
          label: p.label,
          fullDateLabel: p.fullDateLabel,
          dateRange: p.dateRange,
          value: 0,
          actualCount: 0,
          attendanceCount: p.attendanceCount,
          assessmentLabels: p.assessmentLabels,
        }));
      }
      return [];
    }

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
  }, [filteredStudents, grades, attendance, trendFilter, adminMilestone, trendPage]);

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

  // ─── Loading Skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 data-loaded-content w-full min-w-0 max-w-full">
        {/* Unified 12-Column Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          <div className="lg:col-span-9 xl:col-span-9 flex flex-col gap-3">
            {/* 2 Top KPI Card Skeletons (3 layers each) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              {[1, 2].map((card) => (
                <div key={card} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] animate-pulse divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
                  {[1, 2, 3].map((row) => (
                    <div key={row} className="flex-1 flex items-center justify-between px-3.5 py-1.5">
                      <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800" />
                      <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Chart Skeleton: Performance Trend */}
            <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 animate-pulse min-h-[380px] shadow-sm flex flex-col justify-between">
              <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="my-4 flex-1 bg-gray-50/60 dark:bg-[#111111] rounded-lg min-h-[200px]" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-12 rounded bg-gray-50 dark:bg-[#111111]" />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column Skeleton: Top Performing Classes (Full Height) */}
          <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-3">
            <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 animate-pulse min-h-[500px] shadow-sm flex-1">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
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
      {/* ── Main Section: KPI Cards + Trend Chart (Left) & Top Performing Classes (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch w-full min-w-0 max-w-full">
        {/* ── Left Column (9 cols on lg & xl: ~75% width): 2 Top KPI Cards & Trend Chart ── */}
        <div ref={leftColRef} className="lg:col-span-9 xl:col-span-9 flex flex-col gap-3 w-full min-w-0 max-w-full">
          {/* Top 2 KPI Summary Containers (Each has exactly 3 balanced layers) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 w-full min-w-0 max-w-full">
            {/* Container 1: OVERALL HIGH RISK STUDENTS, TOTAL STUDENTS, & TUTORS (3 Layers) */}
            <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-sm">
              <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
                  OVERALL HIGH RISK STUDENTS
                </p>
                <p className="text-xs sm:text-sm font-extrabold text-risk-high shrink-0">
                  <AnimatedCounter value={highRiskStudentsCount} />
                </p>
              </div>
              <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
                  TOTAL STUDENTS
                </p>
                <p className="text-xs sm:text-sm font-extrabold tracking-tight text-gray-900 dark:text-slate-100 shrink-0">
                  <AnimatedCounter value={totalStudentsCount} />
                </p>
              </div>
              <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
                  TUTORS
                </p>
                <p className="text-xs sm:text-sm font-extrabold tracking-tight text-gray-900 dark:text-slate-100 shrink-0">
                  <AnimatedCounter value={totalTutorsCount} />
                </p>
              </div>
            </div>

            {/* Container 2: OVERALL AVERAGE ATTENDANCE, OVERALL AVERAGE SCORE, OVERALL COMPOSITE SCORE (3 Layers) */}
            <div className="flex flex-col justify-between divide-y divide-gray-100 dark:divide-[#1A1A1A] rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] w-full min-w-0 shadow-sm">
              <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
                  OVERALL AVERAGE ATTENDANCE RATE
                </p>
                <p
                  className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                    !hasAttendanceData
                      ? 'text-gray-400 dark:text-slate-500'
                      : overallAttendanceRate >= 81
                      ? 'text-risk-low'
                      : overallAttendanceRate >= 75
                      ? 'text-risk-moderate'
                      : 'text-risk-high'
                  }`}
                >
                  {!hasAttendanceData ? '—' : <AnimatedCounter value={overallAttendanceRate} suffix="%" />}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
                  OVERALL AVERAGE SCORE RATE
                </p>
                <p
                  className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                    !hasScoreData
                      ? 'text-gray-400 dark:text-slate-500'
                      : overallAvgScore >= 81
                      ? 'text-risk-low'
                      : overallAvgScore >= 75
                      ? 'text-risk-moderate'
                      : 'text-risk-high'
                  }`}
                >
                  {!hasScoreData ? '—' : <AnimatedCounter value={overallAvgScore} decimals={overallAvgScore % 1 !== 0 ? 1 : 0} suffix="%" />}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500 truncate mr-2">
                  OVERALL COMPOSITE RATING
                </p>
                <p
                  className={`text-xs sm:text-sm font-extrabold shrink-0 ${
                    !hasAttendanceData && !hasScoreData
                      ? 'text-gray-400 dark:text-slate-500'
                      : overallCompositeScore >= 81
                      ? 'text-risk-low'
                      : overallCompositeScore >= 75
                      ? 'text-risk-moderate'
                      : 'text-risk-high'
                  }`}
                >
                  {!hasAttendanceData && !hasScoreData ? '—' : <AnimatedCounter value={overallCompositeScore} decimals={overallCompositeScore % 1 !== 0 ? 1 : 0} suffix="%" />}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-3.5 sm:p-4 flex flex-col w-full min-w-0 max-w-full shadow-sm">
            {/* ── Row 1: Card Title & Period Toggles (Full width, never truncates title) ── */}
            <div className="flex items-center justify-between gap-3 shrink-0 pb-2.5 sm:pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 uppercase tracking-tight">
                  {selectedTutorObj
                    ? `${selectedTutorObj.name.toUpperCase()}'S STUDENTS PERFORMANCE TREND`
                    : 'PNAHS ARAL PERFORMANCE TREND'}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
                {/* Period Toggles (DAY / WEEK / MONTH) */}
                <SlidingPeriodToggle
                  options={['day', 'week', 'month'] as const}
                  value={trendFilter}
                  onChange={(filter) => {
                    setTrendFilter(filter);
                    setTrendPage(0);
                  }}
                  ariaLabel="Performance trend period"
                  buttonClassName="px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[9px] sm:text-[10px]"
                />
                {/* Period navigation arrows */}
                <div className="flex items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-[#111111]" role="group" aria-label="Scroll between previous and present records">
                  <button
                    type="button"
                    onClick={() => setTrendPage((p) => p + 1)}
                    disabled={trendPage >= 10}
                    aria-label="Previous records"
                    title={trendPage >= 10 ? 'Earliest historical records reached' : 'Scroll to previous records'}
                    className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E1E1E] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                  >
                    <ChevronLeft size={14} className="stroke-[2.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendPage((p) => Math.max(0, p - 1))}
                    disabled={trendPage === 0}
                    aria-label="Next records"
                    title={trendPage === 0 ? 'Viewing present records' : 'Scroll towards present records'}
                    className="flex items-center justify-center h-[26px] w-[26px] rounded-sm text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#1E1E1E] hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-600 disabled:cursor-not-allowed transition-all cursor-pointer shadow-none hover:shadow-xs"
                  >
                    <ChevronRight size={14} className="stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Row 2: Filter Controls Bar (Tutor Dropdown and Handled Classes Dropdown) ── */}
            <div className="flex items-center gap-2 pt-2.5 pb-1 flex-wrap w-full relative z-30">
              {/* Tutor Filter Dropdown */}
              <div className={`relative min-w-[130px] flex-1 max-w-[220px] ${isTutorMenuOpen ? 'z-50' : 'z-20'}`} ref={tutorDropdownRef}>
                <button
                  type="button"
                  aria-label="Filter by Tutor"
                  aria-haspopup="listbox"
                  aria-expanded={isTutorMenuOpen}
                  onClick={() => {
                    setIsTutorMenuOpen((prev) => !prev);
                    setIsClassMenuOpen(false);
                  }}
                  className="flex h-8 w-full items-center justify-between gap-1.5 sm:gap-2 rounded-xl border border-gray-200 bg-gray-50 dark:border-[#1A1A1A] dark:bg-[#111111] px-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-normal text-gray-700 dark:text-slate-200 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shadow-2xs"
                >
                  <span className="truncate">{selectedTutorLabel}</span>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isTutorMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isTutorMenuOpen && (
                  <div
                    className="absolute left-0 top-full z-50 mt-1 max-h-60 w-56 sm:w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1.5 shadow-xl"
                    role="listbox"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedTutorId === 'all'}
                      onClick={() => {
                        setSelectedTutorId('all');
                        setTrendPage(0);
                        setIsTutorMenuOpen(false);
                      }}
                      className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                        selectedTutorId === 'all'
                          ? 'bg-[var(--brand)] text-white'
                          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                      }`}
                    >
                      ALL TUTORS
                    </button>
                    {[...tutors]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((tutor) => {
                        const isSel = String(selectedTutorId) === String(tutor.id);
                        return (
                          <button
                            key={tutor.id}
                            type="button"
                            role="option"
                            aria-selected={isSel}
                            onClick={() => {
                              setSelectedTutorId(String(tutor.id));
                              setTrendPage(0);
                              setIsTutorMenuOpen(false);
                            }}
                            className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                              isSel
                                ? 'bg-[var(--brand)] text-white'
                                : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                            }`}
                          >
                            {tutor.name.toUpperCase()}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Class Filter Dropdown (defaults to ALL CLASSES, filled with tutor's classes once selected) */}
              <div className={`relative min-w-[130px] flex-1 max-w-[220px] ${isClassMenuOpen ? 'z-50' : 'z-20'}`} ref={classDropdownRef}>
                <button
                  type="button"
                  aria-label="Filter by Class"
                  aria-haspopup="listbox"
                  aria-expanded={isClassMenuOpen}
                  onClick={() => {
                    setIsClassMenuOpen((prev) => !prev);
                    setIsTutorMenuOpen(false);
                  }}
                  className="flex h-8 w-full items-center justify-between gap-1.5 sm:gap-2 rounded-xl border border-gray-200 bg-gray-50 dark:border-[#1A1A1A] dark:bg-[#111111] px-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-normal text-gray-700 dark:text-slate-200 transition hover:border-gray-300 dark:hover:border-[#262626] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 cursor-pointer shadow-2xs"
                >
                  <span className="truncate">{selectedClassLabel}</span>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isClassMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isClassMenuOpen && (
                  <div
                    className="absolute right-0 sm:left-0 top-full z-50 mt-1 max-h-60 w-56 sm:w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white dark:border-[#1A1A1A] dark:bg-[#0A0A0A] p-1.5 shadow-xl"
                    role="listbox"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selectedClass === 'all'}
                      onClick={() => {
                        setSelectedClass('all');
                        setTrendPage(0);
                        setIsClassMenuOpen(false);
                      }}
                      className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                        selectedClass === 'all'
                          ? 'bg-[var(--brand)] text-white'
                          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                      }`}
                    >
                      ALL CLASSES
                    </button>
                    {chartClasses.map((cls) => {
                      const isSel = selectedClass === cls;
                      return (
                        <button
                          key={cls}
                          type="button"
                          role="option"
                          aria-selected={isSel}
                          onClick={() => {
                            setSelectedClass(cls);
                            setTrendPage(0);
                            setIsClassMenuOpen(false);
                          }}
                          className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                            isSel
                              ? 'bg-[var(--brand)] text-white'
                              : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1A1A1A]'
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="relative h-[210px] sm:h-[240px] w-full mt-3 sm:mt-4 bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-lg px-2 py-2 sm:px-4 sm:py-3 overflow-hidden">
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
                      ? 'text-risk-moderate'
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
                      ? 'text-risk-moderate'
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

        </div>

                {/* ── Right Column (3 cols on lg & xl: ~25% width): TOP PERFORMING CLASSES ── */}
        <div className="lg:col-span-3 xl:col-span-3 lg:relative flex flex-col w-full min-w-0 max-w-full">
          <div
            style={
              isDesktop && leftColHeight
                ? { height: `${leftColHeight}px`, maxHeight: `${leftColHeight}px` }
                : undefined
            }
            className="lg:absolute lg:inset-0 bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-3.5 sm:p-4 flex flex-col w-full max-h-[500px] lg:max-h-none shadow-sm overflow-hidden"
          >
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
                placeholder="Search Tutor or Class Name"
                className="w-full h-7.5 pl-8 pr-2.5 rounded-sm bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] text-xs text-gray-800 dark:text-slate-200 placeholder-gray-400 focus:outline-none focus:border-[var(--brand)]"
              />
            </div>

            {/* Ranked Tutors List */}
            <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 flex flex-col">
              {filteredRankedTutors.length === 0 ? (
                <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center p-6 text-center select-none bg-gray-50/50 dark:bg-[#111111]/40 border border-dashed border-gray-200 dark:border-[#1E1E1E] rounded-lg">
                  <Users className="w-8 h-8 text-gray-200 dark:text-gray-700 mb-2" />
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                    {rankedTutorClasses.length === 0 ? 'No tutor classes found' : 'No tutors matching search'}
                  </p>
                  <p className="text-[11px] text-gray-400/80 dark:text-slate-600 mt-1 max-w-[220px] leading-relaxed">
                    {rankedTutorClasses.length === 0
                      ? 'Academic rankings will display once tutors are assigned to classes'
                      : 'Try checking for typos or searching by another tutor name'}
                  </p>
                </div>
              ) : (
                filteredRankedTutors.map((item) => (
                  <div
                    key={item.tutorId}
                    onClick={() => navigate(`/principal/analytics?tutorId=${item.tutorId}`)}
                    className="block p-2.5 rounded-md border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#111111]/70 hover:bg-gray-100/60 dark:hover:bg-white/[0.03] hover:border-gray-300 dark:hover:border-zinc-700 transition-colors group cursor-pointer shadow-xs"
                    title={`Click to view data analytics for ${item.tutorName}`}
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-slate-100 group-hover:text-[var(--brand)] transition-colors truncate">
                          {item.tutorName}
                        </p>
                        <p
                          className="text-[10px] font-medium text-gray-400 dark:text-slate-500 truncate mt-0.5"
                          title={item.classesHandled}
                        >
                          {item.classesHandled}
                        </p>
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
                              ? 'text-risk-moderate border-amber-200 bg-amber-50 dark:border-amber-800/80 dark:bg-amber-950/40'
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrincipalHome;
