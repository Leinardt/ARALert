import React, { useState, useEffect, useMemo, useId } from 'react';

export interface RiskTrendPoint {
  dateKey: string;
  label: string;
  high: number;
  medium: number;
  low: number;
  value?: number;
}

export type TrendFilter = 'day' | 'week' | 'month';

export interface RiskLevelTrendWidgetProps {
  data: RiskTrendPoint[];
  total: number;
  isSingleStudent: boolean;
  studentName?: string;
  activeFilter: TrendFilter;
  onFilterChange: (filter: TrendFilter) => void;
  studentFilter?: React.ReactNode;
}

// Abbreviate verbose date labels like "Aug 17 – Aug 21" to "Aug 17–21"
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

export const RiskLevelTrendWidget: React.FC<RiskLevelTrendWidgetProps> = ({
  data,
  total,
  isSingleStudent,
  studentName,
  activeFilter,
  onFilterChange,
  studentFilter,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const uniqueId = useId().replace(/:/g, '');

  // Trigger smooth staggered entrance on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Compute week-over-week high risk trend indicator
  const highRiskTrend = useMemo(() => {
    if (!data || data.length < 2) return null;
    const current = data[data.length - 1]?.high ?? 0;
    const previous = data[data.length - 2]?.high ?? 0;
    if (previous === 0 && current === 0) return { dir: 'flat' as const, pct: 0 };
    if (previous === 0) return { dir: 'up' as const, pct: 100 };
    const diff = current - previous;
    const pct = Math.round((diff / previous) * 100);
    return {
      dir: pct < 0 ? ('down' as const) : pct > 0 ? ('up' as const) : ('flat' as const),
      pct: Math.abs(pct),
    };
  }, [data]);

  // Max value calculation for dynamic Y-axis (0, 5, 10, ...)
  const maxTotal = useMemo(() => {
    if (isSingleStudent) return 1;
    const maxCount = Math.max(
      ...data.map((p) => (p.high || 0) + (p.medium || 0) + (p.low || 0)),
      0
    );
    return Math.max(10, Math.ceil(maxCount / 5) * 5);
  }, [data, isSingleStudent]);

  const axisSteps = useMemo(() => {
    if (isSingleStudent) return [0, 1];
    return Array.from({ length: maxTotal / 5 + 1 }, (_, i) => i * 5);
  }, [isSingleStudent, maxTotal]);

  // Palette as requested:
  // High: #F3716B (coral red)
  // Medium: #FFB648 (warm amber)
  // Low: #4ECB8D (soft emerald)
  const series = [
    { key: 'high' as const, label: 'High', color: '#F3716B', gradId: `grad-coral-${uniqueId}` },
    { key: 'medium' as const, label: 'Medium', color: '#FFB648', gradId: `grad-amber-${uniqueId}` },
    { key: 'low' as const, label: 'Low', color: '#4ECB8D', gradId: `grad-emerald-${uniqueId}` },
  ];

  // Desktop chart dimensions
  const dWidth = 800;
  const dHeight = 220;
  const dPaddingLeft = 44;
  const dPaddingRight = 16;
  const dPaddingTop = 22;
  const dPaddingBottom = 32;
  const dChartWidth = dWidth - dPaddingLeft - dPaddingRight;
  const dChartHeight = dHeight - dPaddingTop - dPaddingBottom;
  const dBarWidth = Math.max(18, Math.min(32, (dChartWidth / (data.length || 1)) * 0.36));
  const getDBarX = (idx: number) =>
    dPaddingLeft + dBarWidth / 2 + (idx * (dChartWidth - dBarWidth)) / (data.length - 1 || 1);

  // Mobile chart dimensions
  const mobileBarSlotWidth = 44;
  const mWidth = Math.max(300, data.length * mobileBarSlotWidth + 48);
  const mHeight = 240;
  const mPaddingLeft = 34;
  const mPaddingRight = 16;
  const mPaddingTop = 18;
  const mPaddingBottom = 48;
  const mChartWidth = mWidth - mPaddingLeft - mPaddingRight;
  const mChartHeight = mHeight - mPaddingTop - mPaddingBottom;
  const mBarWidth = Math.max(12, Math.min(18, (mChartWidth / (data.length || 1)) * 0.4));
  const getMBarX = (idx: number) =>
    mPaddingLeft + mBarWidth / 2 + (idx * (mChartWidth - mBarWidth)) / (data.length - 1 || 1);

  // Render segmented toggle control
  const renderToggle = (isMobile: boolean) => (
    <div
      className={`inline-flex items-center rounded-xl bg-gray-100/90 dark:bg-[#151A24] p-1 border border-gray-200/60 dark:border-slate-800/80 ${
        isMobile ? 'w-full justify-between' : ''
      }`}
      role="group"
      aria-label="Filter risk chart by time period"
    >
      {(['day', 'week', 'month'] as TrendFilter[]).map((filter) => {
        const isActive = activeFilter === filter;
        return (
          <button
            key={filter}
            type="button"
            onClick={() => onFilterChange(filter)}
            className={`cursor-pointer rounded-lg font-semibold uppercase tracking-wider transition-all ${
              isMobile
                ? `flex-1 min-h-[40px] px-3 text-xs ${
                    isActive
                      ? 'bg-[var(--brand)] text-white shadow-xs font-bold'
                      : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white border border-transparent'
                  }`
                : `px-3.5 py-1.5 min-h-[32px] text-[11px] ${
                    isActive
                      ? 'bg-[var(--brand)] text-white shadow-xs font-bold'
                      : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white border border-transparent'
                  }`
            }`}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );

  return (
    <section
      className="rounded-2xl border border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0A0E17] shadow-sm p-4 sm:p-6 md:p-7 transition-shadow w-full min-w-0 max-w-full overflow-hidden"
      aria-labelledby={`risk-trend-heading-${uniqueId}`}
    >
      {/* ── DESKTOP HEADER (Single clean horizontal row) ── */}
      <div className="hidden md:flex md:items-center md:justify-between gap-4 pb-4 mb-2 border-b border-gray-100 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <h3
            id={`risk-trend-heading-${uniqueId}`}
            className="text-base font-bold text-gray-900 dark:text-slate-100 tracking-tight"
          >
            Risk Level Trend
          </h3>
          {highRiskTrend && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                highRiskTrend.dir === 'down'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
                  : highRiskTrend.dir === 'up'
                  ? 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700'
              }`}
              title="Week-over-week change in high risk students"
            >
              {highRiskTrend.dir === 'down' && `▼ ${highRiskTrend.pct}% High risk`}
              {highRiskTrend.dir === 'up' && `▲ ${highRiskTrend.pct}% High risk`}
              {highRiskTrend.dir === 'flat' && `— 0% vs last wk`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Color-coded Legend */}
          <div className="flex items-center gap-3.5 text-xs font-medium text-gray-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#F3716B' }} />
              High
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#FFB648' }} />
              Medium
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: '#4ECB8D' }} />
              Low
            </span>
          </div>

          {/* Student Filter dropdown */}
          {studentFilter && <div className="shrink-0">{studentFilter}</div>}

          {/* Day / Week / Month Segmented Toggle */}
          <div className="shrink-0">{renderToggle(false)}</div>
        </div>
      </div>

      {/* ── MOBILE HEADER (3 Clean Stacked Rows) ── */}
      <div className="flex flex-col gap-3 pb-3.5 mb-2 border-b border-gray-100 dark:border-slate-800/60 md:hidden">
        {/* ROW 1: Title & Trend indicator */}
        <div className="flex items-center justify-between gap-2">
          <h3
            id={`risk-trend-heading-mobile-${uniqueId}`}
            className="text-base font-bold text-gray-900 dark:text-slate-100 tracking-tight"
          >
            Risk Level Trend
          </h3>
          {highRiskTrend && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                highRiskTrend.dir === 'down'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
                  : highRiskTrend.dir === 'up'
                  ? 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              {highRiskTrend.dir === 'down' && `▼ ${highRiskTrend.pct}% High`}
              {highRiskTrend.dir === 'up' && `▲ ${highRiskTrend.pct}% High`}
              {highRiskTrend.dir === 'flat' && `— 0%`}
            </span>
          )}
        </div>

        {/* ROW 2: Student Filter & Toggle */}
        <div className="flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-2">
          {studentFilter && <div className="flex-1 min-w-0">{studentFilter}</div>}
          <div className="flex-1 xs:flex-initial">{renderToggle(true)}</div>
        </div>

        {/* ROW 3: Legend */}
        <div className="flex items-center justify-around py-1.5 px-3 rounded-lg bg-gray-50/80 dark:bg-slate-900/40 text-xs font-medium text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-800/40">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#F3716B' }} />
            High
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#FFB648' }} />
            Medium
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#4ECB8D' }} />
            Low
          </span>
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {data.length === 0 ? (
        <div className="flex min-h-[220px] items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500">
          No risk trend data available
        </div>
      ) : (
        <>
          {/* ── DESKTOP CHART VIEW ── */}
          <div className="hidden md:block relative select-none">
            <svg
              viewBox={`0 0 ${dWidth} ${dHeight}`}
              preserveAspectRatio="none"
              className="h-56 w-full overflow-visible block"
              role="img"
              aria-label="Risk level trend stacked bar chart"
            >
              <defs>
                <linearGradient id={`grad-coral-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F78680" />
                  <stop offset="100%" stopColor="#EA5F58" />
                </linearGradient>
                <linearGradient id={`grad-amber-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFC366" />
                  <stop offset="100%" stopColor="#F5A52B" />
                </linearGradient>
                <linearGradient id={`grad-emerald-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5ED59C" />
                  <stop offset="100%" stopColor="#3DBF7B" />
                </linearGradient>
                <filter id={`hover-shadow-${uniqueId}`} x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.18" />
                </filter>

                {/* Softly rounded top/bottom clipPaths for each desktop bar stack */}
                {data.map((point, index) => {
                  const x = getDBarX(index);
                  const high = point.high || 0;
                  const med = point.medium || 0;
                  const low = point.low || 0;
                  const totalCount = high + med + low;
                  const totalH = (totalCount / maxTotal) * dChartHeight;
                  const yTop = dPaddingTop + dChartHeight - totalH;
                  return (
                    <clipPath key={`dclip-${index}`} id={`dbar-clip-${uniqueId}-${index}`}>
                      <rect
                        x={x - dBarWidth / 2}
                        y={yTop}
                        width={dBarWidth}
                        height={Math.max(totalH, 0)}
                        rx={5}
                        ry={5}
                      />
                    </clipPath>
                  );
                })}
              </defs>

              {/* Extremely subtle alternating column zebra shading */}
              {data.map((point, index) => {
                if (index % 2 !== 0) return null;
                const x = getDBarX(index);
                const slotW = Math.max(dBarWidth + 24, (dChartWidth / (data.length || 1)) * 0.72);
                return (
                  <rect
                    key={`dz-${point.dateKey}`}
                    x={x - slotW / 2}
                    y={dPaddingTop}
                    width={slotW}
                    height={dChartHeight}
                    fill="currentColor"
                    className="text-slate-900/[0.015] dark:text-white/[0.018]"
                    rx={6}
                  />
                );
              })}

              {/* Dynamic Y-Axis Lines and Labels (0, 5, 10, ...) */}
              {axisSteps.map((val) => {
                const y = dPaddingTop + dChartHeight - (val / maxTotal) * dChartHeight;
                return (
                  <g key={`daxis-${val}`}>
                    <line
                      x1={dPaddingLeft}
                      y1={y}
                      x2={dWidth - dPaddingRight}
                      y2={y}
                      stroke="var(--slate-200, #E2E8F0)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      className="opacity-60 dark:opacity-20"
                    />
                    <text
                      x={dPaddingLeft - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 dark:fill-slate-500 font-medium text-[10px]"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Stacked Bars & X-Axis Labels */}
              {data.map((point, index) => {
                const x = getDBarX(index);
                const highCount = point.high || 0;
                const medCount = point.medium || 0;
                const lowCount = point.low || 0;

                const lowH = (lowCount / maxTotal) * dChartHeight;
                const medH = (medCount / maxTotal) * dChartHeight;
                const highH = (highCount / maxTotal) * dChartHeight;
                const totalH = lowH + medH + highH;

                let currentY = dPaddingTop + dChartHeight;
                const isHovered = hoveredIdx === index;

                return (
                  <g
                    key={point.dateKey}
                    onMouseEnter={() => setHoveredIdx(index)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {/* Animated, softly-clipped stacked bar */}
                    <g
                      clipPath={`url(#dbar-clip-${uniqueId}-${index})`}
                      style={{
                        transformOrigin: `${x}px ${dPaddingTop + dChartHeight}px`,
                        transform: isAnimated
                          ? isHovered
                            ? 'scaleY(1) translateY(-2px)'
                            : 'scaleY(1)'
                          : 'scaleY(0)',
                        transition: isHovered
                          ? 'transform 160ms ease-out'
                          : `transform 420ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 55}ms`,
                        filter: isHovered ? `url(#hover-shadow-${uniqueId})` : undefined,
                      }}
                    >
                      {/* Low segment (bottom) */}
                      {lowH > 0 && (() => {
                        currentY -= lowH;
                        return (
                          <rect
                            x={x - dBarWidth / 2}
                            y={currentY}
                            width={dBarWidth}
                            height={lowH}
                            fill={`url(#grad-emerald-${uniqueId})`}
                            stroke="#FFFFFF"
                            strokeWidth="0.75"
                            strokeOpacity="0.6"
                          />
                        );
                      })()}

                      {/* Medium segment (middle) */}
                      {medH > 0 && (() => {
                        currentY -= medH;
                        return (
                          <rect
                            x={x - dBarWidth / 2}
                            y={currentY}
                            width={dBarWidth}
                            height={medH}
                            fill={`url(#grad-amber-${uniqueId})`}
                            stroke="#FFFFFF"
                            strokeWidth="0.75"
                            strokeOpacity="0.6"
                          />
                        );
                      })()}

                      {/* High segment (top) */}
                      {highH > 0 && (() => {
                        currentY -= highH;
                        return (
                          <rect
                            x={x - dBarWidth / 2}
                            y={currentY}
                            width={dBarWidth}
                            height={highH}
                            fill={`url(#grad-coral-${uniqueId})`}
                            stroke="#FFFFFF"
                            strokeWidth="0.75"
                            strokeOpacity="0.6"
                          />
                        );
                      })()}
                    </g>

                    {/* Subtle selection ring on hover */}
                    {isHovered && totalH > 0 && (
                      <rect
                        x={x - dBarWidth / 2 - 2}
                        y={dPaddingTop + dChartHeight - totalH - 3}
                        width={dBarWidth + 4}
                        height={totalH + 4}
                        fill="none"
                        stroke="#0052B7"
                        strokeWidth="1.5"
                        rx={6}
                        className="pointer-events-none opacity-80"
                      />
                    )}

                    {/* X-Axis Date Range Label */}
                    <text
                      x={x}
                      y={dHeight - 8}
                      textAnchor="middle"
                      className="fill-slate-500 dark:fill-slate-400 font-medium text-[10px]"
                    >
                      {point.label}
                    </text>

                    {/* Invisible Hit Region for seamless hover */}
                    <rect
                      x={x - Math.max(dBarWidth, 36) / 2}
                      y={dPaddingTop}
                      width={Math.max(dBarWidth, 36)}
                      height={dChartHeight + 20}
                      fill="transparent"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Desktop Tooltip */}
            {hoveredIdx !== null && data[hoveredIdx] && (() => {
              const p = data[hoveredIdx];
              const barX = getDBarX(hoveredIdx);
              const barLeftPct = ((barX - dBarWidth / 2) / dWidth) * 100;
              const barRightPct = ((barX + dBarWidth / 2) / dWidth) * 100;
              const isNearRight = barRightPct > 72;
              const high = p.high || 0;
              const med = p.medium || 0;
              const low = p.low || 0;
              const totalCount = high + med + low;

              return (
                <div
                  className="pointer-events-none absolute z-20 min-w-[160px] max-w-[240px] rounded-xl border border-slate-700/60 bg-slate-900/95 p-3 text-left text-xs leading-normal text-white shadow-xl backdrop-blur-sm"
                  style={{
                    left: isNearRight ? `calc(${barLeftPct}% - 14px)` : `calc(${barRightPct}% + 14px)`,
                    top: '45%',
                    transform: isNearRight ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1.5 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                      {p.label}
                    </span>
                    {isSingleStudent && studentName && (
                      <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[100px]" title={studentName}>
                        {studentName}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {series.map((item) => {
                      const count = p[item.key] || 0;
                      return (
                        <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex items-center gap-1.5" style={{ color: item.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}
                          </span>
                          <span className="font-bold text-white">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  {!isSingleStudent && (
                    <div className="mt-2 pt-1.5 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>Total</span>
                      <span className="font-bold text-white">{totalCount} students</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── MOBILE / PHONE CHART VIEW ── */}
          <div className="block md:hidden relative select-none">
            {/* Mobile swipe helper */}
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 pb-1 px-1 font-medium">
              <span>Tap bar for counts</span>
              <span className="text-gray-400">Swipe history &rarr;</span>
            </div>

            <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain mobile-scroll-table -mx-1 px-1 rounded-md">
              <div style={{ minWidth: `${mWidth}px` }}>
                <svg
                  viewBox={`0 0 ${mWidth} ${mHeight}`}
                  className="w-full h-[240px] overflow-visible block"
                  role="img"
                  aria-label="Risk level trend mobile chart"
                >
                  <defs>
                    {/* Softly rounded top/bottom clipPaths for each mobile bar stack */}
                    {data.map((point, index) => {
                      const x = getMBarX(index);
                      const high = point.high || 0;
                      const med = point.medium || 0;
                      const low = point.low || 0;
                      const totalCount = high + med + low;
                      const totalH = (totalCount / maxTotal) * mChartHeight;
                      const yTop = mPaddingTop + mChartHeight - totalH;
                      return (
                        <clipPath key={`mclip-${index}`} id={`mbar-clip-${uniqueId}-${index}`}>
                          <rect
                            x={x - mBarWidth / 2}
                            y={yTop}
                            width={mBarWidth}
                            height={Math.max(totalH, 0)}
                            rx={5}
                            ry={5}
                          />
                        </clipPath>
                      );
                    })}
                  </defs>

                  {/* Zebra striping behind mobile columns */}
                  {data.map((point, index) => {
                    if (index % 2 !== 0) return null;
                    const x = getMBarX(index);
                    const slotW = Math.max(mBarWidth + 24, (mChartWidth / (data.length || 1)) * 0.72);
                    return (
                      <rect
                        key={`mz-${point.dateKey}`}
                        x={x - slotW / 2}
                        y={mPaddingTop}
                        width={slotW}
                        height={mChartHeight}
                        fill="currentColor"
                        className="text-slate-900/[0.015] dark:text-white/[0.018]"
                        rx={6}
                      />
                    );
                  })}

                  {/* Mobile Dynamic Y-Axis Lines and Labels (0, 5, 10, ...) at 13px */}
                  {axisSteps.map((val) => {
                    const y = mPaddingTop + mChartHeight - (val / maxTotal) * mChartHeight;
                    return (
                      <g key={`maxis-${val}`}>
                        <line
                          x1={mPaddingLeft}
                          y1={y}
                          x2={mWidth - mPaddingRight}
                          y2={y}
                          stroke="var(--slate-200, #E2E8F0)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                          className="opacity-60 dark:opacity-20"
                        />
                        <text
                          x={mPaddingLeft - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          className="fill-slate-500 dark:fill-slate-400 font-medium text-[10px]"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Mobile Stacked Bars & Rotated ~35° Date Labels */}
                  {data.map((point, index) => {
                    const x = getMBarX(index);
                    const highCount = point.high || 0;
                    const medCount = point.medium || 0;
                    const lowCount = point.low || 0;

                    const lowH = (lowCount / maxTotal) * mChartHeight;
                    const medH = (medCount / maxTotal) * mChartHeight;
                    const highH = (highCount / maxTotal) * mChartHeight;
                    const totalH = lowH + medH + highH;

                    let currentY = mPaddingTop + mChartHeight;
                    const isHovered = hoveredIdx === index;
                    const shortLabel = formatShortDateRange(point.label);

                    return (
                      <g
                        key={`mb-${point.dateKey}`}
                        onMouseEnter={() => setHoveredIdx(index)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          setHoveredIdx(hoveredIdx === index ? null : index);
                        }}
                        onClick={() => setHoveredIdx(hoveredIdx === index ? null : index)}
                        className="cursor-pointer"
                      >
                        {/* Animated, softly-clipped stacked bar */}
                        <g
                          clipPath={`url(#mbar-clip-${uniqueId}-${index})`}
                          style={{
                            transformOrigin: `${x}px ${mPaddingTop + mChartHeight}px`,
                            transform: isAnimated
                              ? isHovered
                                ? 'scaleY(1) translateY(-2px)'
                                : 'scaleY(1)'
                              : 'scaleY(0)',
                            transition: isHovered
                              ? 'transform 160ms ease-out'
                              : `transform 420ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 55}ms`,
                            filter: isHovered ? `url(#hover-shadow-${uniqueId})` : undefined,
                          }}
                        >
                          {/* Low segment */}
                          {lowH > 0 && (() => {
                            currentY -= lowH;
                            return (
                              <rect
                                x={x - mBarWidth / 2}
                                y={currentY}
                                width={mBarWidth}
                                height={lowH}
                                fill={`url(#grad-emerald-${uniqueId})`}
                                stroke="#FFFFFF"
                                strokeWidth="0.75"
                                strokeOpacity="0.6"
                              />
                            );
                          })()}

                          {/* Medium segment */}
                          {medH > 0 && (() => {
                            currentY -= medH;
                            return (
                              <rect
                                x={x - mBarWidth / 2}
                                y={currentY}
                                width={mBarWidth}
                                height={medH}
                                fill={`url(#grad-amber-${uniqueId})`}
                                stroke="#FFFFFF"
                                strokeWidth="0.75"
                                strokeOpacity="0.6"
                              />
                            );
                          })()}

                          {/* High segment */}
                          {highH > 0 && (() => {
                            currentY -= highH;
                            return (
                              <rect
                                x={x - mBarWidth / 2}
                                y={currentY}
                                width={mBarWidth}
                                height={highH}
                                fill={`url(#grad-coral-${uniqueId})`}
                                stroke="#FFFFFF"
                                strokeWidth="0.75"
                                strokeOpacity="0.6"
                              />
                            );
                          })()}
                        </g>

                        {/* Selection ring on hover/tap */}
                        {isHovered && totalH > 0 && (
                          <rect
                            x={x - mBarWidth / 2 - 2}
                            y={mPaddingTop + mChartHeight - totalH - 3}
                            width={mBarWidth + 4}
                            height={totalH + 4}
                            fill="none"
                            stroke="#0052B7"
                            strokeWidth="1.5"
                            rx={6}
                            className="pointer-events-none opacity-80"
                          />
                        )}

                        {/* Rotated ~25° Date Label */}
                        <g transform={`translate(${x}, ${mPaddingTop + mChartHeight + 12})`}>
                          <text
                            transform="rotate(-25)"
                            textAnchor="end"
                            className="fill-slate-600 dark:fill-slate-300 font-medium select-none text-[10px]"
                          >
                            {shortLabel}
                          </text>
                        </g>

                        {/* Touch Hit Target (min 42px width) */}
                        <rect
                          x={x - Math.max(mBarWidth, 42) / 2}
                          y={mPaddingTop}
                          width={Math.max(mBarWidth, 42)}
                          height={mChartHeight + 50}
                          fill="transparent"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Mobile Tooltip clamped inside viewport */}
            {hoveredIdx !== null && data[hoveredIdx] && (() => {
              const p = data[hoveredIdx];
              const high = p.high || 0;
              const med = p.medium || 0;
              const low = p.low || 0;
              const totalCount = high + med + low;

              return (
                <div
                  className="pointer-events-none absolute z-20 left-2 right-2 top-2 rounded-xl border border-slate-700/60 bg-slate-900/95 p-3 text-left text-xs leading-normal text-white shadow-2xl backdrop-blur-sm sm:left-auto sm:right-auto sm:min-w-[170px]"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1 mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                      {p.label}
                    </span>
                    {isSingleStudent && studentName && (
                      <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[120px]" title={studentName}>
                        {studentName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {series.map((item) => {
                      const count = p[item.key] || 0;
                      return (
                        <div key={item.key} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span style={{ color: item.color }} className="font-medium">
                            {item.label}:
                          </span>
                          <span className="font-bold text-white">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  {!isSingleStudent && (
                    <div className="mt-1.5 pt-1 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>Total evaluated:</span>
                      <span className="font-bold text-white">{totalCount} students</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </section>
  );
};
