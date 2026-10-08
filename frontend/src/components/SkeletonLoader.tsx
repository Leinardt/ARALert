import React from 'react';

/**
 * Standard reusable skeleton loader primitives and compound widgets
 */

export const Skeleton: React.FC<{
  className?: string;
  style?: React.CSSProperties;
}> = ({ className = '', style }) => {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200/80 dark:bg-zinc-800/80 ${className}`}
      style={style}
    />
  );
};

export const CardSkeleton: React.FC<{
  className?: string;
  rows?: number;
}> = ({ className = '', rows = 3 }) => {
  return (
    <div
      className={`p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#000000] animate-pulse space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="h-8 w-24" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3"
            style={{ width: `${85 - i * 15}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export const StatsGridSkeleton: React.FC<{
  count?: number;
  cols?: string;
}> = ({ count = 4, cols = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' }) => {
  return (
    <div className={`grid gap-3.5 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#000000] animate-pulse space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-5 w-5 rounded-md" />
          </div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-2 w-32" />
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{
  rows?: number;
  cols?: number;
  className?: string;
}> = ({ rows = 5, cols = 4, className = '' }) => {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-[#000000] overflow-hidden ${className}`}
    >
      <div className="p-4 border-b border-slate-100 dark:border-neutral-800/80 flex items-center justify-between animate-pulse">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-neutral-800/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3.5 flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1 max-w-xs">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
            {Array.from({ length: cols - 1 }).map((_, c) => (
              <Skeleton key={c} className="h-3 w-16 hidden sm:block" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
