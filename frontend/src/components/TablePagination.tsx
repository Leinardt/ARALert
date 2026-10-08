import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  totalPages?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
  customShowingText?: React.ReactNode;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  totalPages: propTotalPages,
  pageSize = 30,
  onPageChange,
  className = '',
  itemLabel,
  customShowingText,
}) => {
  const totalPages = propTotalPages !== undefined ? propTotalPages : Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);

  // Group pages into blocks of 5 (1-5, 6-10, 11-15, ...)
  const startPage = Math.floor((page - 1) / 5) * 5 + 1;
  const endPage = Math.min(startPage + 4, totalPages);

  // Generate page numbers for current 5-page window (only existing pages)
  const pageNumbers: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  // Left arrow: only appears when not on the first block (i.e. startPage > 1)
  // because pages 1-5 have nothing to go back to.
  const showLeftArrow = startPage > 1;

  // Right arrow: only appears when there are more pages beyond the current 5-page block
  const showRightArrow = totalPages > endPage;

  const currentCount = totalItems === 0 ? 0 : Math.min(pageSize, Math.max(0, totalItems - (page - 1) * pageSize));

  return (
    <div className={`px-4 py-3 bg-gray-50/70 dark:bg-[#111111] border-t border-gray-100 dark:border-[#1A1A1A] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${className}`}>
      <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
        {customShowingText ? (
          customShowingText
        ) : (
          <span>
            Showing <strong className="font-semibold text-gray-800 dark:text-slate-200">{currentCount}</strong> {itemLabel || 'rows of records'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500">
          Page {page} of {totalPages}
        </span>

        <div className="flex items-center gap-1.5">
          {/* Left Arrow (only when on subsequent page groups beyond 1-5) */}
          {showLeftArrow && (
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, startPage - 5))}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Previous pages"
              aria-label="Previous pages"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 1-5 Numeric Page Buttons (only existing pages) */}
          {pageNumbers.map((p) => {
            const isCurrent = p === page;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-2 flex items-center justify-center rounded-md text-xs font-bold transition cursor-pointer ${
                  isCurrent
                    ? 'bg-[var(--brand)] text-white shadow-xs'
                    : 'bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#222222] text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
                aria-label={`Page ${p}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p}
              </button>
            );
          })}

          {/* Right Arrow (only when more pages exist beyond current group) */}
          {showRightArrow && (
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, startPage + 5))}
              className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Next pages"
              aria-label="Next pages"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
