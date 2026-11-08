import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 1:1 Landing Page Hero Skeleton
 * Matches the public landing page hero with logo on the left and hero copy on the right.
 */
export const LandingFallback: React.FC = () => (
  <div className="min-h-[85vh] w-full flex flex-col justify-center items-center px-4 sm:px-8 lg:px-12 pt-28 pb-20 box-border overflow-hidden skeleton-container animate-pulse">
    <div className="max-w-6xl mx-auto w-full px-2 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left: Brand Logo Placeholder */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="w-40 sm:w-52 md:w-64 lg:w-72 h-44 sm:h-56 md:h-64 rounded-2xl bg-gray-200 dark:bg-gray-800" />
          <div className="mt-6 w-28 sm:w-36 lg:w-44 h-3 rounded-full bg-gray-100 dark:bg-gray-800/60" />
        </div>

        {/* Right: Hero Title, Subtitle, and CTA Button Placeholder */}
        <div className="lg:col-span-7 space-y-5 text-center lg:text-left flex flex-col items-center lg:items-start">
          <div className="h-12 sm:h-16 lg:h-20 w-52 sm:w-72 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="space-y-2.5 w-full max-w-xl">
            <div className="h-4 w-full rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-4 w-11/12 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-4 w-4/5 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="h-11 sm:h-12 w-48 rounded-xl bg-gray-200 dark:bg-gray-800 mt-3" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * 1:1 Login Skeleton Card
 * Matches the centered Sign In Options card container on /login.
 */
export const LoginFallback: React.FC = () => (
  <div className="w-full min-h-[calc(100vh-160px)] flex flex-col items-center justify-center px-3.5 sm:px-6 py-12 sm:py-16 box-border bg-white dark:bg-black">
    <div className="w-full max-w-[540px] mx-auto skeleton-container animate-pulse">
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-200/90 dark:border-neutral-800 shadow-sm p-6 sm:p-8 flex flex-col items-center">
        {/* ARALert Logo Placeholder */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-200 dark:bg-gray-800 mb-3.5" />
        {/* Title & Subtitle */}
        <div className="h-6 w-44 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
        <div className="h-3.5 w-60 rounded bg-gray-100 dark:bg-gray-800 mb-6" />

        {/* 2 Portal Option Cards */}
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
 * 1:1 Dashboard Home Skeleton Wireframe
 * Matches the Tutor / Admin / Principal Dashboard Home with top class filter, 3 KPI cards, chart, and at-risk panel.
 */
export const DashboardFallback: React.FC = () => (
  <div className="space-y-3 w-full min-w-0 max-w-full skeleton-container animate-pulse p-1 sm:p-2">
    {/* Top Class Selector 1:1 Skeleton */}
    <div className="w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-sm space-y-2">
      <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 py-2.5 flex items-center justify-between">
        <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-3 w-4 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-4 lg:items-start gap-3 w-full min-w-0 max-w-full">
      {/* Left Section skeleton: 3 top cards + Chart below */}
      <div className="lg:col-span-3 flex flex-col gap-3 w-full min-w-0 max-w-full">
        {/* 3 KPI Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-3.5 h-[116px] sm:h-[120px] flex flex-col justify-between shadow-sm">
            <div>
              <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
              <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
            {[1, 2].map((i) => (
              <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-2">
                <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
          <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] overflow-hidden h-[116px] sm:h-[120px] divide-y divide-gray-100 dark:divide-[#1A1A1A] flex flex-col justify-between shadow-sm">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 flex items-center justify-between px-3.5 py-1.5">
                <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3.5 w-8 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Chart card skeleton */}
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md px-4 py-3.5 sm:px-5 flex flex-col h-[372px] sm:h-[388px] overflow-hidden shadow-sm">
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
            <div className="relative flex-1 min-h-0 w-full bg-gray-50/60 dark:bg-[#111111] border border-gray-100 dark:border-[#1A1A1A] rounded-sm" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="bg-gray-50 dark:bg-[#111111] px-2 py-1.5 rounded-sm border border-gray-100 dark:border-[#1A1A1A] text-center">
                    <div className="h-2.5 w-12 rounded bg-gray-200 dark:bg-gray-800 mx-auto" />
                    <div className="h-4 w-14 rounded bg-gray-200 dark:bg-gray-800 mx-auto mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* At-Risk panel skeleton */}
      <div className="lg:col-span-1 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-md flex flex-col h-[420px] lg:h-[520px] overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between shrink-0">
          <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-7 rounded-full bg-rose-100 dark:bg-rose-950/40" />
        </div>
        <div className="p-2 space-y-1 flex-1 min-h-0 overflow-y-auto">
          {[1, 2, 3, 4, 5, 6, 7].map((j) => (
            <div key={j} className="px-3 py-2 rounded-sm border border-gray-100 dark:border-[#1A1A1A] bg-gray-50/50 dark:bg-[#111111] flex flex-col justify-between">
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
 * 1:1 Student Profile Skeleton
 * Matches TutorStudentProfile with back button, header card, circular avatar, tabs, KPI cards, and record table.
 */
export const StudentProfileFallback: React.FC = () => (
  <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto skeleton-container animate-pulse p-1 sm:p-2" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
    {/* Back button skeleton */}
    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />

    {/* Student Header Card 1:1 Skeleton */}
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

    {/* Tab nav skeleton */}
    <div className="flex w-full rounded-md bg-gray-100 dark:bg-[#141414] p-1 gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex-1 h-9 rounded-sm bg-gray-200 dark:bg-gray-800" />
      ))}
    </div>

    {/* KPI containers skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-7 w-16 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-2.5 w-36 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      ))}
    </div>

    {/* Table card skeleton */}
    <div className="bg-white dark:bg-[#0A0A0A] rounded-md border border-gray-200 dark:border-[#1A1A1A] shadow-sm p-4 sm:p-6 space-y-4">
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
 * 1:1 Directory / Table Page Skeleton
 * Matches Student Directory, User List, Archive, and Evaluations with class filter, search bar, and rows.
 */
export const DirectoryFallback: React.FC = () => (
  <div className="space-y-4 sm:space-y-6 skeleton-container animate-pulse p-1 sm:p-2" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
    {/* Cohort Filter Skeleton */}
    <div className="w-full rounded-xl border border-gray-200 dark:border-[#1E1E1E] bg-white dark:bg-[#0E0E0E] p-3 sm:px-4 sm:py-3.5 shadow-sm space-y-2">
      <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="w-full min-h-[44px] rounded-lg border border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#141414] px-3.5 py-2.5 flex items-center justify-between">
        <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-3 w-4 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>

    {/* Directory Table Card skeleton */}
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
 * 1:1 Analytics Page Skeleton
 * Matches Tutor and Principal Analytics with tab switcher, 3 KPI cards, and chart card.
 */
export const AnalyticsFallback: React.FC = () => (
  <div className="space-y-4 skeleton-container animate-pulse p-1 sm:p-2" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
    {/* Tab Switcher Skeleton */}
    <div className="flex w-full rounded-md bg-gray-100 dark:bg-[#111111] p-0.5 gap-0.5">
      <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
      <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
      <div className="h-8 flex-1 rounded-sm bg-gray-200 dark:bg-gray-800" />
    </div>

    {/* 3 Summary KPI Cards Skeleton */}
    <div className="grid gap-3 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 min-h-[100px] flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-md bg-gray-200 dark:bg-gray-800 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-2.5 w-20 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
            <div className="h-7 w-14 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-2 w-44 rounded bg-gray-100 dark:bg-gray-800/60 mt-2" />
          </div>
        </div>
      ))}
    </div>

    {/* Chart Card Skeleton */}
    <div className="w-full rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="space-y-1.5">
          <div className="h-4 w-44 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="h-8 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="h-64 w-full bg-gray-50/50 dark:bg-[#111111] rounded border border-gray-100 dark:border-[#1A1A1A]" />
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
 * never needs to shift or adjust when code chunks or data finish loading.
 */
export const PageFallback: React.FC = () => {
  const location = useLocation();
  const path = (location.pathname || '').toLowerCase();

  // 1. Landing Page
  if (path === '/' || path === '') {
    return <LandingFallback />;
  }

  // 2. Login Page
  if (path === '/login') {
    return <LoginFallback />;
  }

  // 3. Legal / Static Public Pages
  if (
    path === '/terms' ||
    path === '/terms-of-service' ||
    path === '/privacy' ||
    path === '/privacy-policy'
  ) {
    return <DocumentFallback />;
  }

  // 4. Student Profile Pages (e.g., /tutor/students/45 or /superadmin/students/12)
  if (path.match(/\/(?:students|users)\/\d+/)) {
    return <StudentProfileFallback />;
  }

  // 5. Directory & User Management Pages
  if (
    path.includes('/students') ||
    path.includes('/users') ||
    path.includes('/tutors') ||
    path.includes('/principals') ||
    path.includes('/admins') ||
    path.includes('/archive') ||
    path.includes('/audit-logs')
  ) {
    return <DirectoryFallback />;
  }

  // 6. Analytics Pages
  if (path.includes('/analytics')) {
    return <AnalyticsFallback />;
  }

  // 7. Scores & Evaluations Pages
  if (path.includes('/scores') || path.includes('/evaluations')) {
    return <DirectoryFallback />;
  }

  // 8. Internal Dashboard Home Pages
  if (
    path === '/tutor' ||
    path === '/admin' ||
    path === '/principal' ||
    path === '/superadmin' ||
    path === '/student'
  ) {
    return <DashboardFallback />;
  }

  // Default fallback
  return <DashboardFallback />;
};

export default PageFallback;
