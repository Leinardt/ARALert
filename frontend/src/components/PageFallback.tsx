import React from 'react';
import { useLocation } from 'react-router-dom';
import aralertLogo from '../assets/ARALert_Logo_LIGHT.png';

/**
 * Landing Page Branded Skeleton
 * Renders a large centered ARALert logo silhouette with the system shimmer animation.
 */
export const LandingFallback: React.FC = () => (
  <div
    className="min-h-screen w-full flex items-center justify-center px-6 py-12 box-border overflow-hidden bg-white dark:bg-black"
    role="status"
    aria-label="Loading ARALert"
  >
    <div
      className="relative overflow-hidden w-48 h-48 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-80 lg:h-80 bg-slate-200 dark:bg-neutral-800"
      style={{
        WebkitMaskImage: `url(${aralertLogo})`,
        maskImage: `url(${aralertLogo})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    >
      <div
        aria-hidden="true"
        className="landing-logo-shimmer-bar absolute inset-0 pointer-events-none"
      />
    </div>
  </div>
);

/**
 * 1:1 Auth / Login Centered Card Skeleton
 * Matches /login, /forgot-password, /reset-password, /activate, /mfa, etc.
 */
export const LoginFallback: React.FC = () => (
  <div className="w-full min-h-[calc(100vh-160px)] flex flex-col items-center justify-center px-3.5 sm:px-6 py-12 sm:py-16 box-border bg-white dark:bg-black">
    <div className="w-full max-w-[540px] mx-auto skeleton-container animate-pulse">
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200/90 dark:border-neutral-800 shadow-sm p-6 sm:p-8 flex flex-col items-center">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 dark:bg-gray-800 mb-3.5" />
        <div className="h-6 w-44 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
        <div className="h-3.5 w-60 rounded bg-gray-100 dark:bg-gray-800 mb-6" />

        <div className="w-full flex flex-col gap-3 sm:gap-3.5">
          <div className="p-4 sm:p-5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-64 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-800 shrink-0 ml-2" />
          </div>

          <div className="p-4 sm:p-5 rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 flex items-center justify-between">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-60 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-800 shrink-0 ml-2" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Shared TutorCohortFilter Bar Skeleton (used on TutorHome, TutorStudentDirectory, TutorScores, TutorQRGenerator)
 */
const CohortFilterSkeletonBar: React.FC = () => (
  <div className="w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-sm space-y-2">
    <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-800" />
    <div className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 py-2.5 flex items-center justify-between">
      <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="h-3 w-4 rounded bg-gray-200 dark:bg-gray-800" />
    </div>
  </div>
);

/**
 * 1:1 Tutor Dashboard Home Skeleton Wireframe
 * Matches TutorHome.tsx (Cohort filter + 3 KPI cards + chart + at-risk panel).
 */
export const DashboardFallback: React.FC = () => (
  <div className="space-y-3 w-full min-w-0 max-w-full skeleton-container animate-pulse">
    <CohortFilterSkeletonBar />

    <div className="grid grid-cols-1 lg:grid-cols-4 lg:items-start gap-3 w-full min-w-0 max-w-full">
      <div className="lg:col-span-3 flex flex-col gap-3 w-full min-w-0 max-w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 h-[116px] sm:h-[120px] flex flex-col justify-between shadow-sm">
            <div>
              <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
              <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
            {[1, 2].map((i) => (
              <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-2">
                <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-1.5">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3.5 w-8 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md px-4 py-3.5 sm:px-5 flex flex-col h-[372px] sm:h-[388px] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between gap-2 shrink-0 pb-3 border-b border-gray-100 dark:border-[#1A1A1A] min-w-0">
            <div className="min-w-0 flex-1">
              <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-nowrap">
              <div className="h-4 w-28 rounded bg-gray-100 dark:bg-gray-800 hidden sm:block" />
              <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800 hidden sm:block" />
              <div className="h-7 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 gap-2.5 mt-3">
            <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#161616] border border-gray-100 dark:border-[#1A1A1A] rounded-sm" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="bg-gray-50 dark:bg-[#161616] px-2 py-1.5 rounded-sm border border-gray-100 dark:border-[#1A1A1A] text-center">
                    <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-gray-800 mx-auto" />
                    <div className="h-4 w-14 rounded bg-gray-200 dark:bg-gray-800 mx-auto mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-1 bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md flex flex-col h-[420px] lg:h-[520px] overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between shrink-0">
          <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-7 rounded-full bg-rose-100 dark:bg-rose-950/40" />
        </div>
        <div className="p-2 space-y-1 flex-1 min-h-0 overflow-y-auto">
          {[1, 2, 3, 4, 5, 6, 7].map((j) => (
            <div key={j} className="px-3 py-2 rounded-sm border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#161616] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3.5 w-10 rounded-full bg-rose-100 dark:bg-rose-950/50 shrink-0" />
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <div className="h-2.5 w-20 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-2.5 w-8 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/**
 * 1:1 Admin & SuperAdmin Dashboard Home Skeleton
 * Matches AdminHome.tsx (3 multi-layer KPI cards + 9/3 trend chart & right sidebar).
 */
export const AdminDashboardFallback: React.FC = () => (
  <div className="flex flex-col gap-3 w-full min-w-0 max-w-full skeleton-container animate-pulse">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
        {[1, 2].map((i) => (
          <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-2">
            <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-12 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-1">
            <div className="h-2 w-20 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-3.5 w-8 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-1.5">
            <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
      <div className="lg:col-span-9 flex flex-col gap-3">
        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 min-h-[380px] shadow-sm flex flex-col justify-between">
          <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="my-4 flex-1 bg-gray-50/60 dark:bg-[#161616] rounded-lg min-h-[200px]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-12 rounded bg-gray-50 dark:bg-[#161616]" />
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-3 flex flex-col gap-3">
        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 min-h-[380px] shadow-sm">
          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((k) => (
              <div key={k} className="h-10 rounded bg-gray-50 dark:bg-[#161616]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * 1:1 Principal Dashboard Home Skeleton
 * Matches PrincipalHome.tsx (9-col with 2 KPI cards + chart, 3-col full-height Top Performing Classes).
 */
export const PrincipalDashboardFallback: React.FC = () => (
  <div className="flex flex-col gap-3 w-full min-w-0 max-w-full skeleton-container animate-pulse">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
      <div className="lg:col-span-9 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          {[1, 2].map((card) => (
            <div key={card} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden h-[116px] sm:h-[120px] divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
              {[1, 2, 3].map((row) => (
                <div key={row} className="flex-1 flex items-center justify-between px-3.5 py-1.5">
                  <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 min-h-[380px] shadow-sm flex flex-col justify-between">
          <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="my-4 flex-1 bg-gray-50/60 dark:bg-[#161616] rounded-lg min-h-[200px]" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-12 rounded bg-gray-50 dark:bg-[#161616]" />
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-col gap-3">
        <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md p-4 min-h-[500px] shadow-sm flex-1">
          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
              <div key={k} className="h-10 rounded bg-gray-50 dark:bg-[#161616]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * 1:1 Student Dashboard Home Skeleton
 * Matches StudentHome.tsx (hero + 3-layer stacked card, full-height trend chart below).
 */
export const StudentDashboardFallback: React.FC = () => (
  <div className="flex flex-col lg:h-[calc(100vh-8.5rem)] lg:min-h-[30rem] gap-3 skeleton-container animate-pulse">
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-3 shrink-0">
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 shadow-sm">
        <div className="h-2.5 w-28 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
        <div className="h-12 w-24 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] overflow-hidden divide-y divide-gray-100 dark:divide-[#1A1A1A] shadow-sm">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-10 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>

    <div className="flex-1 flex flex-col min-h-0">
      <div className="w-full bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A] rounded-md px-4 py-4 sm:px-5 flex flex-col h-full min-h-[320px] shadow-sm">
        <div className="flex items-center justify-between gap-2 shrink-0 pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-7 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="flex-1 flex flex-col min-h-0 gap-3 mt-3.5 sm:mt-4">
          <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#161616] border border-gray-100 dark:border-[#1A1A1A] rounded-md" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 shrink-0">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="bg-gray-50 dark:bg-[#161616] p-2 rounded-md border border-gray-100 dark:border-[#1A1A1A] text-center">
                <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-gray-800 mx-auto" />
                <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-800 mx-auto mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * 1:1 Student Profile Skeleton
 * Matches TutorStudentProfile with back button, header card, tabs, KPI cards, and table card.
 */
export const StudentProfileFallback: React.FC = () => (
  <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto skeleton-container animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />

    <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-5">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="space-y-2 min-w-0">
            <div className="h-6 w-52 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-2.5 w-28 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="h-9 w-36 rounded-md bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-32 rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    </div>

    <div className="flex w-full rounded-md bg-gray-100 dark:bg-[#141414] p-1 gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex-1 h-9 rounded-sm bg-gray-200 dark:bg-gray-800" />
      ))}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-2.5 w-36 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      ))}
    </div>

    <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="space-y-1.5">
          <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="h-8 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 dark:border-gray-900/50">
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-16 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * 1:1 Tutor Student Directory Skeleton
 * Matches TutorStudentDirectory.tsx (CohortFilter + Directory Table card).
 */
export const DirectoryFallback: React.FC = () => (
  <div className="space-y-4 sm:space-y-6 skeleton-container animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
    <CohortFilterSkeletonBar />

    <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="space-y-1.5">
          <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="h-8 sm:h-8.5 w-full sm:w-52 rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>

      <div className="p-3.5 sm:p-6 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 dark:border-gray-900/50">
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="h-4 w-20 rounded bg-gray-100 dark:bg-gray-800 hidden md:block" />
            <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-800" />
            <div className="h-6 w-6 rounded-md bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * 1:1 Tutor Workspace Skeleton (Score Entry / QR Attendance)
 * Matches TutorScores.tsx and TutorQRGenerator.tsx (max-w-6xl, CohortFilter + tabs + workspace card).
 */
export const TutorWorkspaceFallback: React.FC = () => (
  <div className="space-y-6 max-w-6xl mx-auto skeleton-container animate-pulse">
    <CohortFilterSkeletonBar />

    <div className="grid grid-cols-2 rounded-md bg-gray-100 dark:bg-[#111111] border border-gray-200/70 dark:border-[#1A1A1A] p-1 gap-1">
      <div className="h-8 rounded-sm bg-gray-200 dark:bg-gray-800" />
      <div className="h-8 rounded-sm bg-gray-100 dark:bg-gray-800/60" />
    </div>

    <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-36 rounded-md bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-32 rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="h-4 flex-1 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
          <div className="h-8 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * 1:1 Tutor Archive Skeleton
 * Matches TutorArchive.tsx (max-w-7xl, 3-filter card + switcher tabs + archive table card).
 */
export const TutorArchiveFallback: React.FC = () => (
  <div className="flex flex-col gap-3.5 sm:gap-5 p-2.5 sm:p-6 max-w-7xl mx-auto w-full skeleton-container animate-pulse">
    <div className="w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-3.5 sm:px-4 sm:py-3.5 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
        <div className="sm:col-span-3 space-y-1">
          <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-10 rounded-lg bg-gray-100 dark:bg-[#161616] border border-gray-200 dark:border-[#222222]" />
        </div>
        <div className="sm:col-span-6 space-y-1">
          <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-10 rounded-lg bg-gray-100 dark:bg-[#161616] border border-gray-200 dark:border-[#222222]" />
        </div>
        <div className="sm:col-span-3 space-y-1">
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-10 rounded-lg bg-gray-100 dark:bg-[#161616] border border-gray-200 dark:border-[#222222]" />
        </div>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
      <div className="h-9 w-full sm:w-72 rounded-md bg-gray-100 dark:bg-[#1A1A1A]" />
      <div className="h-9 w-full sm:w-80 rounded-md bg-gray-100 dark:bg-[#1A1A1A]" />
    </div>

    <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="space-y-1.5">
          <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-36 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-52 rounded-md bg-gray-100 dark:bg-gray-800" />
          <div className="h-8 w-28 rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-10 rounded-md bg-gray-100 dark:bg-gray-800/70" />
      ))}
    </div>
  </div>
);

/**
 * 1:1 Admin/SuperAdmin User List Skeleton
 * Matches UserList.tsx (Top role tabs + table toolbar + rows).
 */
export const UserListFallback: React.FC = () => (
  <div className="space-y-4 sm:space-y-6 skeleton-container animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
    <div className="grid grid-cols-5 rounded-md bg-gray-100 p-1 gap-1 dark:bg-[#111111] border border-gray-200/70 dark:border-[#1A1A1A]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-8 rounded-sm bg-gray-200/80 dark:bg-gray-800" />
      ))}
    </div>

    <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-24 rounded-md bg-gray-100 dark:bg-gray-800" />
          <div className="h-8 w-44 rounded-md bg-gray-100 dark:bg-gray-800" />
          <div className="h-8 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-10 rounded-md bg-gray-100 dark:bg-gray-800/70" />
      ))}
    </div>
  </div>
);

/**
 * 1:1 Admin Evaluation Hub & Assessments Archive Skeleton
 */
export const EvaluationHubFallback: React.FC = () => (
  <div className="space-y-5 skeleton-container animate-pulse">
    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-zinc-800">
      <div className="h-9 w-40 rounded-xl bg-gray-200 dark:bg-gray-800" />
      <div className="h-10 w-80 rounded-xl bg-gray-100 dark:bg-zinc-900" />
    </div>
    <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="h-5 w-52 bg-slate-200 dark:bg-zinc-800 rounded-md" />
        <div className="h-9 w-48 bg-slate-200 dark:bg-zinc-800 rounded-xl" />
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-10 rounded-md bg-slate-100 dark:bg-zinc-900" />
      ))}
    </div>
  </div>
);

/**
 * 1:1 Audit Log Skeleton
 * Matches AuditLog.tsx (search/filter bar + log rows card).
 */
export const AuditLogFallback: React.FC = () => (
  <div className="space-y-4 skeleton-container animate-pulse">
    <div className="flex flex-col sm:flex-row gap-2.5">
      <div className="h-9 flex-1 rounded-xl bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A]" />
      <div className="h-9 w-full sm:w-44 rounded-xl bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A]" />
      <div className="h-9 w-full sm:w-36 rounded-xl bg-white dark:bg-[#111111] border border-gray-200 dark:border-[#1A1A1A]" />
      <div className="h-9 w-full sm:w-36 rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm p-6 space-y-3">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="h-10 bg-slate-100 dark:bg-zinc-900 rounded-lg" />
      ))}
    </div>
  </div>
);

/**
 * 1:1 Tickets Checklist Skeleton
 * Matches Tickets.tsx (tab bar + checklist rows).
 */
export const TicketsFallback: React.FC = () => (
  <div className="space-y-4 skeleton-container animate-pulse">
    <div className="h-10 w-full rounded-md bg-gray-100 dark:bg-[#111111] border border-gray-200/70 dark:border-[#1A1A1A]" />
    <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm divide-y divide-gray-100 dark:divide-[#1A1A1A]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 flex items-start gap-3">
          <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-800 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-5 w-24 rounded-full bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="h-3 w-full max-w-lg rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * 1:1 Settings & Centered Form Skeleton
 * Matches Settings.tsx, CreateUser.tsx, EditUser.tsx, and Profile.tsx.
 */
export const SettingsFormFallback: React.FC = () => (
  <div className="max-w-4xl mx-auto flex flex-col gap-4 w-full min-w-0 skeleton-container animate-pulse">
    <div className="p-8 sm:p-10 rounded-2xl border border-slate-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-md space-y-6">
      <div className="h-5 w-52 rounded bg-gray-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-10 rounded-md bg-gray-100 dark:bg-zinc-900" />
        <div className="h-10 rounded-md bg-gray-100 dark:bg-zinc-900" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-10 rounded-md bg-gray-100 dark:bg-zinc-900" />
        <div className="h-10 rounded-md bg-gray-100 dark:bg-zinc-900" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-16 rounded-md bg-gray-100 dark:bg-zinc-900" />
        <div className="h-16 rounded-md bg-gray-100 dark:bg-zinc-900" />
        <div className="h-16 rounded-md bg-gray-100 dark:bg-zinc-900" />
      </div>
    </div>
  </div>
);

/**
 * 1:1 Student QR Attendance Skeleton
 * Matches StudentQRAttendance.tsx (left QR code card + right recent scans card).
 */
export const StudentAttendanceFallback: React.FC = () => (
  <div className="space-y-4 sm:space-y-5 skeleton-container animate-pulse">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
      <div className="lg:col-span-7 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 sm:p-6 flex flex-col items-center justify-center min-h-[380px] shadow-sm space-y-4">
        <div className="w-52 h-52 rounded-lg bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-8 w-36 rounded-md bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="lg:col-span-5 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 sm:p-5 space-y-3 min-h-[380px] shadow-sm">
        <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-800 pb-3 border-b border-gray-100 dark:border-[#1A1A1A]" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-gray-50 dark:bg-[#161616] rounded-md" />
        ))}
      </div>
    </div>
  </div>
);

/**
 * 1:1 Student Scores Skeleton
 * Matches StudentScores.tsx (3 KPI cards + scores history table card).
 */
export const StudentScoresFallback: React.FC = () => (
  <div className="space-y-4 skeleton-container animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm p-4 min-h-[100px] flex items-center gap-3.5"
        >
          {i < 3 && <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
            <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-2 w-44 rounded bg-gray-100 dark:bg-gray-800/60 mt-2" />
          </div>
        </div>
      ))}
    </div>

    <div className="bg-white dark:bg-[#111111] rounded-md border border-gray-200 dark:border-[#1A1A1A] overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="space-y-1">
          <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="h-8 w-28 rounded-md bg-gray-100 dark:bg-gray-800" />
      </div>
      <div className="p-4 sm:p-5 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 rounded-md bg-gray-100 dark:bg-gray-800/70" />
        ))}
      </div>
    </div>
  </div>
);

/**
 * 1:1 Analytics Page Skeleton
 * Matches TutorAnalytics, PrincipalAnalytics (with tabs) and StudentAnalytics (without tabs).
 */
export const AnalyticsFallback: React.FC<{ showTabs?: boolean }> = ({ showTabs = true }) => (
  <div className="space-y-4 skeleton-container animate-pulse" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
    {showTabs && (
      <div className="flex w-full rounded-md bg-gray-100 dark:bg-[#111111] p-0.5 gap-0.5">
        <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
        <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
        <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
      </div>
    )}

    <div className="grid gap-3 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 min-h-[100px] flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
            <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-2 w-44 rounded bg-gray-100 dark:bg-gray-800/60 mt-2" />
          </div>
        </div>
      ))}
    </div>

    <div className="w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="space-y-1.5">
          <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="h-8 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="h-64 w-full bg-gray-50/50 dark:bg-[#161616] rounded border border-gray-100 dark:border-[#1A1A1A]" />
    </div>
  </div>
);

/**
 * 1:1 Document / Public Page Skeleton
 */
export const DocumentFallback: React.FC = () => (
  <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6 skeleton-container animate-pulse">
    <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-800" />
    <div className="h-4 w-48 rounded bg-gray-100 dark:bg-gray-800" />
    <div className="space-y-3 pt-4">
      <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-4 w-11/12 rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-4 w-4/5 rounded bg-gray-100 dark:bg-gray-800" />
    </div>
    <div className="space-y-3 pt-4">
      <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-4 w-5/6 rounded bg-gray-100 dark:bg-gray-800" />
    </div>
  </div>
);

/**
 * Exact 1:1 Route-Matching PageFallback
 * Selects the matching 1:1 skeleton immediately upon URL navigation so the layout
 * transitions seamlessly into each page's own 1:1 loading skeleton or content.
 */
export const PageFallback: React.FC = () => {
  const location = useLocation();
  const path = (location.pathname || '').toLowerCase().replace(/\/+$/, '') || '/';

  // 1. Public & Auth Routes
  if (path === '/') return <LandingFallback />;
  if (
    path === '/login' ||
    path === '/activate' ||
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/mfa' ||
    path === '/invalid-link' ||
    path === '/success'
  ) {
    return <LoginFallback />;
  }
  if (
    path === '/terms' ||
    path === '/terms-of-service' ||
    path === '/privacy' ||
    path === '/privacy-policy' ||
    path === '/403' ||
    path === '/404' ||
    path === '/500'
  ) {
    return <DocumentFallback />;
  }

  // 2. Role Dashboard Home Pages
  if (path === '/tutor') return <DashboardFallback />;
  if (path === '/admin' || path === '/superadmin') return <AdminDashboardFallback />;
  if (path === '/principal') return <PrincipalDashboardFallback />;
  if (path === '/student') return <StudentDashboardFallback />;

  // 3. Create / Edit User Forms & Settings & Profile
  if (
    path.endsWith('/create') ||
    path.includes('/edit/') ||
    path.endsWith('/settings') ||
    path.endsWith('/profile')
  ) {
    return <SettingsFormFallback />;
  }

  // 4. Tutor Student Profile (/tutor/students/:id) & Tutor Student Directory (/tutor/students)
  if (path.match(/^\/tutor\/students\/\d+/)) return <StudentProfileFallback />;
  if (path === '/tutor/students') return <DirectoryFallback />;

  // 5. Tutor Attendance & Scores Workspaces
  if (path.startsWith('/tutor/attendance') || path.startsWith('/tutor/scores')) {
    return <TutorWorkspaceFallback />;
  }

  // 6. Archive Routes (Tutor Archive vs Admin/SuperAdmin Archive)
  if (path === '/tutor/archive') return <TutorArchiveFallback />;
  if (path.endsWith('/archive') || path.endsWith('/evaluations')) {
    return <EvaluationHubFallback />;
  }

  // 7. SuperAdmin & Admin Operations
  if (path.endsWith('/audit-logs')) return <AuditLogFallback />;
  if (path.endsWith('/tickets')) return <TicketsFallback />;
  if (
    path.endsWith('/users') ||
    path.endsWith('/students') ||
    path.endsWith('/tutors') ||
    path.endsWith('/principals') ||
    path.endsWith('/admins') ||
    path.endsWith('/superadmins')
  ) {
    return <UserListFallback />;
  }

  // 8. Student Subpages
  if (path === '/student/attendance') return <StudentAttendanceFallback />;
  if (path === '/student/scores' || path === '/student/academic-records') {
    return <StudentScoresFallback />;
  }
  if (path === '/student/analytics') return <AnalyticsFallback showTabs={false} />;

  // 9. Analytics Pages (Tutor & Principal)
  if (path.endsWith('/analytics')) return <AnalyticsFallback showTabs />;

  return <DocumentFallback />;
};

export default PageFallback;
