import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export interface SlidingIndicatorStyle {
  left: number;
  width: number;
  ready: boolean;
  animate: boolean;
}

/**
 * Tracks the active item's horizontal geometry inside a relative segmented track
 * so a pill indicator can glide smoothly across variable-width or scrollable tabs.
 */
export function useSlidingIndicator(activeIndex: number, deps: readonly unknown[] = []) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const hasMountedRef = useRef(false);
  const [pillStyle, setPillStyle] = useState<SlidingIndicatorStyle>({
    left: 0,
    width: 0,
    ready: false,
    animate: false,
  });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const target = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    if (!container || !target) {
      setPillStyle((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }

    const nextLeft = target.offsetLeft;
    const nextWidth = target.offsetWidth;
    const shouldAnimate = hasMountedRef.current;

    setPillStyle((prev) => {
      if (
        prev.ready &&
        prev.left === nextLeft &&
        prev.width === nextWidth &&
        prev.animate === shouldAnimate
      ) {
        return prev;
      }
      return {
        left: nextLeft,
        width: nextWidth,
        ready: true,
        animate: shouldAnimate,
      };
    });

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
    }
  }, [activeIndex]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    measure();
  }, [measure, ...deps]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  const setItemRef = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      itemRefs.current[index] = el;
    },
    []
  );

  return { containerRef, setItemRef, pillStyle };
}

export interface SlidingTabItem<T extends string = string> {
  id: T;
  label: string;
  shortLabel?: string;
  to?: string;
}

interface SlidingTabBarProps<T extends string> {
  tabs: readonly SlidingTabItem<T>[];
  activeTab: T;
  onChange?: (tabId: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Full-width equal-column tablist matching User Management's sliding brand pill.
 */
export function SlidingTabBar<T extends string>({
  tabs,
  activeTab,
  onChange,
  ariaLabel,
  className = '',
}: SlidingTabBarProps<T>) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );

  return (
    <div
      className={`relative grid w-full rounded-md bg-gray-100 p-1 dark:bg-[#111111] border border-gray-200/70 dark:border-[#1A1A1A] select-none overflow-hidden ${className}`}
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
      }}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-sm bg-[var(--brand)] shadow-xs transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${tabs.length})`,
          transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
        }}
      />
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const itemClassName = `relative z-10 h-8 rounded-sm px-2 sm:px-4 flex items-center justify-center text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider transition-colors duration-200 cursor-pointer whitespace-nowrap select-none ${
          isActive
            ? 'text-white'
            : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
        }`;

        const labelNode = tab.shortLabel ? (
          <>
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </>
        ) : (
          <span>{tab.label}</span>
        );

        if (tab.to) {
          return (
            <Link
              key={tab.id}
              to={tab.to}
              role="tab"
              aria-selected={isActive}
              className={itemClassName}
            >
              {labelNode}
            </Link>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(tab.id)}
            className={itemClassName}
          >
            {labelNode}
          </button>
        );
      })}
    </div>
  );
}

interface SlidingPeriodToggleProps<T extends string> {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
  idPrefix?: string;
  className?: string;
  buttonClassName?: string;
  indicatorClassName?: string;
}

/**
 * Compact sliding segmented control for period filters (DAY/WEEK/MONTH, WEEK/MONTH).
 */
export function SlidingPeriodToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  className = 'bg-gray-100 dark:bg-[#111111]',
  buttonClassName = 'px-2.5 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px]',
  indicatorClassName = 'top-0.5 bottom-0.5 rounded-sm bg-[var(--brand)] shadow-xs',
}: SlidingPeriodToggleProps<T>) {
  const activeIndex = value ? options.indexOf(value) : -1;
  const { containerRef, setItemRef, pillStyle } = useSlidingIndicator(activeIndex, [
    options.join(','),
    buttonClassName,
  ]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative inline-flex items-center rounded-md p-0.5 gap-0.5 shrink-0 whitespace-nowrap select-none overflow-hidden ${className}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 will-change-transform motion-reduce:transition-none ${indicatorClassName} ${
          pillStyle.animate
            ? 'transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
            : ''
        } ${pillStyle.ready ? 'opacity-100' : 'opacity-0'}`}
        style={{
          width: `${pillStyle.width}px`,
          transform: `translate3d(${pillStyle.left}px, 0, 0)`,
        }}
      />
      {options.map((option, index) => {
        const isActive = value === option;
        return (
          <button
            key={option}
            ref={setItemRef(index)}
            id={idPrefix ? `${idPrefix}-${option}` : undefined}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option)}
            className={`relative z-10 cursor-pointer rounded-sm font-bold uppercase tracking-wider transition-colors duration-200 whitespace-nowrap ${buttonClassName} ${
              isActive
                ? 'text-white'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
