import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  RefreshCw,
  Check,
  ChevronDown,
  X,
} from 'lucide-react';
import { ticketService, SupportTicketItem } from '../../services/ticketService';
import { TablePagination } from '../../components/TablePagination';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import { matchesSearch } from '../../utils/searchHelpers';
import { useSlidingIndicator } from '../../components/SlidingTabs';

type TicketFilterTab = 'all' | 'under_review' | 'in_progress' | 'resolved' | 'dismissed';

const QUICK_RESOLUTION_NOTES = [
  'Issue fixed and verified.',
  'Account/data record updated as requested.',
  'Guided user on the correct workflow.',
  'System configuration adjusted.',
];

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} • ${d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const Tickets: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TicketFilterTab>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState<boolean>(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 20;

  // Inline checklist resolution/dismissal state
  const [activeAction, setActiveAction] = useState<{
    ticketId: string;
    type: 'resolve' | 'dismiss';
  } | null>(null);
  const [actionReply, setActionReply] = useState<string>('');
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.show]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const fetchTickets = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const res = await ticketService.getTickets('all');
      setTickets(res.results || []);
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
      setError(err?.response?.data?.detail || err?.response?.data?.error || 'Failed to load support tickets.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets(true);
  }, [fetchTickets]);

  // Checklist summary counts
  const counts = useMemo(() => {
    const total = tickets.length;
    const underReview = tickets.filter((t) => t.status === 'UNDER_REVIEW').length;
    const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
    const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;
    const dismissed = tickets.filter((t) => t.status === 'DISMISSED').length;
    const completed = resolved + dismissed;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, underReview, inProgress, resolved, dismissed, completed, completionPct };
  }, [tickets]);

  const roleOptions = useMemo(() => {
    const base = [
      { value: 'all', label: 'ALL ROLES' },
      { value: 'student', label: 'STUDENT' },
      { value: 'tutor', label: 'TUTOR' },
      { value: 'principal', label: 'PRINCIPAL' },
      { value: 'admin', label: 'ADMIN' },
    ];
    return base;
  }, []);

  const filteredTickets = useMemo(() => {
    const filtered = tickets.filter((t) => {
      if (activeTab === 'under_review' && t.status !== 'UNDER_REVIEW') return false;
      if (activeTab === 'in_progress' && t.status !== 'IN_PROGRESS') return false;
      if (activeTab === 'resolved' && t.status !== 'RESOLVED') return false;
      if (activeTab === 'dismissed' && t.status !== 'DISMISSED') return false;

      if (roleFilter !== 'all') {
        const submitterRoleLower = (t.submitter_role || '').toLowerCase();
        if (!submitterRoleLower.includes(roleFilter)) return false;
      }

      if (searchQuery.trim()) {
        const matched = matchesSearch(
          searchQuery,
          t.ticket_id,
          t.submitter_name,
          t.submitter_role,
          t.contact_email,
          t.description,
          t.lrn || '',
          t.claimed_by_name || '',
          t.resolved_by_name || ''
        );
        if (!matched) return false;
      }

      return true;
    });

    // Sort active checklist items first: IN_PROGRESS -> UNDER_REVIEW -> RESOLVED -> DISMISSED, newest first within each group
    const statusWeight: Record<SupportTicketItem['status'], number> = {
      IN_PROGRESS: 0,
      UNDER_REVIEW: 1,
      RESOLVED: 2,
      DISMISSED: 3,
    };

    return [...filtered].sort((a, b) => {
      const wDiff = statusWeight[a.status] - statusWeight[b.status];
      if (wDiff !== 0) return wDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tickets, activeTab, roleFilter, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, roleFilter, searchQuery]);

  const paginatedTickets = useMemo(() => {
    return filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredTickets, page]);

  const notifySidebarTicketsUpdated = () => {
    window.dispatchEvent(new CustomEvent('aralert:refresh-tickets'));
  };

  const handleQuickAction = async (
    ticketId: string,
    action: 'claim' | 'resolve' | 'reopen'
  ) => {
    setUpdatingTicketId(ticketId);
    try {
      const defaultReply =
        action === 'resolve' ? 'Issue has been resolved by the administrator.' : undefined;
      const res = await ticketService.updateTicketAction(ticketId, action, defaultReply);
      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === ticketId ? res.ticket : t))
      );
      if (activeAction?.ticketId === ticketId) {
        setActiveAction(null);
        setActionReply('');
      }
      notifySidebarTicketsUpdated();
      setToast({
        show: true,
        type: 'success',
        title:
          action === 'claim'
            ? 'Ticket In Progress'
            : action === 'reopen'
            ? 'Ticket Reopened'
            : 'Ticket Resolved',
        message: res.message,
      });
    } catch (err: any) {
      setToast({
        show: true,
        type: 'error',
        title: 'Update Failed',
        message: err?.response?.data?.error || 'Failed to update ticket status.',
      });
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleSubmitActionForm = async () => {
    if (!activeAction) return;
    if (activeAction.type === 'dismiss' && !actionReply.trim()) {
      setToast({
        show: true,
        type: 'error',
        title: 'Reason Required',
        message: 'Please provide a dismissal reason before closing the ticket.',
      });
      return;
    }
    setUpdatingTicketId(activeAction.ticketId);
    try {
      const res = await ticketService.updateTicketAction(
        activeAction.ticketId,
        activeAction.type,
        actionReply.trim()
      );
      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === activeAction.ticketId ? res.ticket : t))
      );
      setToast({
        show: true,
        type: 'success',
        title: activeAction.type === 'resolve' ? 'Ticket Resolved' : 'Ticket Closed',
        message: res.message,
      });
      setActiveAction(null);
      setActionReply('');
      notifySidebarTicketsUpdated();
    } catch (err: any) {
      setToast({
        show: true,
        type: 'error',
        title: 'Action Failed',
        message: err?.response?.data?.error || 'Failed to submit ticket update.',
      });
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleCheckboxToggle = (ticket: SupportTicketItem) => {
    if (updatingTicketId === ticket.ticket_id) return;
    if (ticket.status === 'RESOLVED' || ticket.status === 'DISMISSED') {
      handleQuickAction(ticket.ticket_id, 'reopen');
      return;
    }
    if (activeAction?.ticketId === ticket.ticket_id && activeAction.type === 'resolve') {
      setActiveAction(null);
      setActionReply('');
    } else {
      setActiveAction({ ticketId: ticket.ticket_id, type: 'resolve' });
      setActionReply('');
    }
  };

  const tabs: { id: TicketFilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'ALL', count: counts.total },
    { id: 'under_review', label: 'UNDER REVIEW', count: counts.underReview },
    { id: 'in_progress', label: 'IN PROGRESS', count: counts.inProgress },
    { id: 'resolved', label: 'RESOLVED', count: counts.resolved },
    { id: 'dismissed', label: 'CLOSED', count: counts.dismissed },
  ];

  const activeTabIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );
  const { containerRef: tabsRef, setItemRef: setTabRef, pillStyle: tabPillStyle } =
    useSlidingIndicator(activeTabIndex, [counts.total, counts.underReview, counts.inProgress, counts.resolved, counts.dismissed]);

  const activeRoleLabel = roleOptions.find((r) => r.value === roleFilter)?.label || 'ALL ROLES';

  return (
    <div
      className="space-y-4 sm:space-y-5 max-w-7xl mx-auto w-full"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* ── Checklist Progress Summary Card ─────────────────────────────── */}
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-tight">
              Support Tickets
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400">
              Track problem reports from submission to investigation and resolution
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300">
              <AnimatedCounter value={counts.completed} /> / <AnimatedCounter value={counts.total} /> Completed ({counts.completionPct}%)
            </span>
          </div>
        </div>

        {/* Unified Checklist Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden border border-gray-200/80 dark:border-[#242424]">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${counts.completionPct}%` }}
          />
        </div>

        {/* Status Breakdown Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-md border border-gray-200 dark:border-[#1E1E1E] bg-gray-50/70 dark:bg-[#151515] px-3 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Total
            </span>
            <span className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
              <AnimatedCounter value={counts.total} />
            </span>
          </div>
          <div className="rounded-md border border-slate-200 dark:border-[#1E1E1E] bg-slate-50/70 dark:bg-[#151515] px-3 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Under Review
            </span>
            <span className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-200">
              <AnimatedCounter value={counts.underReview} />
            </span>
          </div>
          <div className="rounded-md border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              In Progress
            </span>
            <span className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400">
              <AnimatedCounter value={counts.inProgress} />
            </span>
          </div>
          <div className="rounded-md border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 px-3 py-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Resolved
            </span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400">
              <AnimatedCounter value={counts.resolved} />
            </span>
          </div>
        </div>
      </div>

      {/* ── Top Status Navigation Tabs ──────────────────────────────────── */}
      <div
        ref={tabsRef}
        className="relative flex w-full rounded-md bg-gray-100 p-1 gap-0.5 dark:bg-[#111111] border border-gray-200/70 dark:border-[#1A1A1A] overflow-x-auto no-scrollbar select-none"
        role="tablist"
        aria-label="Ticket status tabs"
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute top-1 bottom-1 left-0 rounded-sm bg-[var(--brand)] shadow-xs will-change-transform motion-reduce:transition-none ${
            tabPillStyle.animate
              ? 'transition-[transform,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
              : ''
          } ${tabPillStyle.ready ? 'opacity-100' : 'opacity-0'}`}
          style={{
            width: `${tabPillStyle.width}px`,
            transform: `translate3d(${tabPillStyle.left}px, 0, 0)`,
          }}
        />
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={setTabRef(index)}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`relative z-10 flex-1 h-8 rounded-sm px-2.5 sm:px-4 flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider transition-colors duration-200 cursor-pointer whitespace-nowrap select-none ${
                isActive
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold leading-tight transition-colors duration-200 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 dark:bg-[#222222] text-gray-600 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Main Checklist Container Card ───────────────────────────────── */}
      <div className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] shadow-sm overflow-visible">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 sm:px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-xs sm:text-sm uppercase tracking-wide">
              Tickets Queue
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-[#1A1A1A] text-slate-600 dark:text-slate-300">
              {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
            </span>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            {/* Role Filter Dropdown */}
            <div ref={roleDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
                className="h-8 min-w-[120px] px-2.5 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#151515] text-[11px] font-bold text-gray-700 dark:text-slate-200 flex items-center justify-between gap-2 cursor-pointer hover:border-gray-300 dark:hover:border-[#2A2A2A] transition-colors"
                aria-haspopup="listbox"
                aria-expanded={isRoleDropdownOpen}
              >
                <span>{activeRoleLabel}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${
                    isRoleDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isRoleDropdownOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 sm:left-0 top-full mt-1 w-44 rounded-lg border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#151515] shadow-xl py-1 z-40"
                >
                  {roleOptions.map((opt) => {
                    const selected = roleFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setRoleFilter(opt.value);
                          setIsRoleDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[11px] font-bold flex items-center justify-between cursor-pointer transition-colors ${
                          selected
                            ? 'bg-[var(--brand)] text-white'
                            : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-[#1F1F1F]'
                        }`}
                      >
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket, name, issue..."
                aria-label="Search tickets"
                className="h-8 w-full sm:w-56 lg:w-64 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#151515] pl-8 pr-2.5 text-[11px] font-semibold text-gray-700 dark:text-slate-200 outline-none placeholder:text-gray-400 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15"
              />
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => fetchTickets(false)}
              disabled={isRefreshing || isLoading}
              className="h-8 px-2.5 rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#151515] text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#1E1E1E] inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-50"
              title="Refresh tickets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Checklist Items Body */}
        <div key={activeTab} className="tab-panel-enter">
        {isLoading ? (
          <div className="p-3 sm:p-5 space-y-3.5 bg-[#F8FAFC] dark:bg-[#0B0B0B]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`tkt-skel-${i}`}
                className="relative rounded-xl border border-gray-200 dark:border-[#222222] bg-white dark:bg-[#121212] flex flex-col md:flex-row animate-pulse"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[1px] top-1/2 -translate-y-1/2 w-4 h-7 overflow-hidden z-10"
                >
                  <span className="block w-7 h-7 -ml-3.5 rounded-full bg-[#F8FAFC] dark:bg-[#0B0B0B] border border-gray-200 dark:border-[#222222]" />
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-[1px] top-1/2 -translate-y-1/2 w-4 h-7 overflow-hidden z-10"
                >
                  <span className="block w-7 h-7 ml-0.5 rounded-full bg-[#F8FAFC] dark:bg-[#0B0B0B] border border-gray-200 dark:border-[#222222]" />
                </span>

                <div className="flex-1 pl-6 sm:pl-7 pr-6 md:pr-5 py-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-800 shrink-0" />
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
                      <div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-gray-800" />
                    </div>
                    <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-800" />
                  </div>
                  <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-12 w-full rounded-md bg-gray-100 dark:bg-gray-800/70" />
                </div>

                <div className="relative md:w-48 lg:w-52 shrink-0 border-t md:border-t-0 md:border-l border-dashed border-gray-200 dark:border-[#262626] bg-gray-50/70 dark:bg-[#151515] rounded-b-[11px] md:rounded-bl-none md:rounded-r-[11px] pl-6 md:pl-5 pr-6 sm:pr-7 py-3.5 flex items-center justify-end md:justify-center">
                  <div className="h-7 w-28 rounded-md bg-gray-200 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center text-rose-600 dark:text-rose-400">
            <p className="text-xs font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => fetchTickets(true)}
              className="mt-3 px-4 py-1.5 bg-[var(--brand)] text-white rounded-md text-xs font-bold cursor-pointer hover:bg-[var(--brand-dark)] transition"
            >
              Retry
            </button>
          </div>
        ) : paginatedTickets.length === 0 ? (
          <div className="py-14 px-4 text-center">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              No tickets found
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {searchQuery || roleFilter !== 'all'
                ? 'Try clearing your search or role filter.'
                : 'Submitted problem reports will appear here.'}
            </p>
          </div>
        ) : (
          <div className="p-3 sm:p-5 space-y-3.5 bg-[#F8FAFC] dark:bg-[#0B0B0B]">
            {paginatedTickets.map((t) => {
              const isPending = t.status === 'UNDER_REVIEW';
              const isInProgress = t.status === 'IN_PROGRESS';
              const isResolved = t.status === 'RESOLVED';
              const isDismissed = t.status === 'DISMISSED';
              const isDone = isResolved || isDismissed;
              const isUpdating = updatingTicketId === t.ticket_id;
              const isDrawerOpen = activeAction?.ticketId === t.ticket_id;

              const ticketBorderColor = isResolved
                ? 'border-emerald-200 dark:border-emerald-900/60'
                : isInProgress
                ? 'border-amber-200 dark:border-amber-900/60'
                : isDismissed
                ? 'border-gray-200 dark:border-[#242424]'
                : 'border-gray-200 dark:border-[#262626]';

              const ticketCardSurface = isResolved
                ? 'bg-white dark:bg-[#101613]'
                : isDismissed
                ? 'bg-white/85 dark:bg-[#101010] opacity-85'
                : 'bg-white dark:bg-[#121212]';

              const stubSurface = isResolved
                ? 'bg-emerald-50/45 dark:bg-[#121C17]'
                : isInProgress
                ? 'bg-amber-50/45 dark:bg-[#1A160E]'
                : isDismissed
                ? 'bg-gray-50/80 dark:bg-[#141414]'
                : 'bg-slate-50/80 dark:bg-[#151515]';

              return (
                <article
                  key={t.id}
                  className={`relative rounded-xl border ${ticketBorderColor} ${ticketCardSurface} transition-colors flex flex-col md:flex-row`}
                >
                  {/* Left & Right Semicircular Ticket Notches breaking the outer border cleanly */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-[1px] top-1/2 -translate-y-1/2 w-4 h-7 overflow-hidden z-10"
                  >
                    <span
                      className={`block w-7 h-7 -ml-3.5 rounded-full bg-[#F8FAFC] dark:bg-[#0B0B0B] border ${ticketBorderColor}`}
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-[1px] top-1/2 -translate-y-1/2 w-4 h-7 overflow-hidden z-10"
                  >
                    <span
                      className={`block w-7 h-7 ml-0.5 rounded-full bg-[#F8FAFC] dark:bg-[#0B0B0B] border ${ticketBorderColor}`}
                    />
                  </span>

                  {/* Main Ticket Body */}
                  <div className="relative flex-1 min-w-0 rounded-t-[11px] md:rounded-tr-none md:rounded-l-[11px] pl-6 sm:pl-7 pr-6 md:pr-5 py-3.5 space-y-2.5">
                    {/* Ticket Header Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-dashed border-gray-200 dark:border-[#242424]">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        {/* Interactive Checklist Checkbox */}
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleCheckboxToggle(t)}
                          aria-label={
                            isDone
                              ? `Reopen ticket ${t.ticket_id}`
                              : `Resolve ticket ${t.ticket_id}`
                          }
                          title={
                            isDone
                              ? 'Click to uncheck and reopen ticket'
                              : 'Click to mark ticket as resolved'
                          }
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
                            isResolved
                              ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                              : isDismissed
                              ? 'bg-slate-500 border-slate-500 text-white hover:bg-slate-600'
                              : isInProgress
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100'
                              : 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-[#151515] hover:border-[var(--brand)]'
                          }`}
                        >
                          {isResolved && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          {isDismissed && <X className="w-3.5 h-3.5 stroke-[3]" />}
                          {isInProgress && (
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                          )}
                        </button>

                        <span
                          className={`font-mono text-xs sm:text-sm font-extrabold tracking-tight ${
                            isDone
                              ? 'line-through text-gray-500 dark:text-slate-400'
                              : 'text-gray-900 dark:text-slate-100'
                          }`}
                        >
                          #{t.ticket_id}
                        </span>

                        {/* Status Pill */}
                        {isPending && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2A2A2A]">
                            Under Review
                          </span>
                        )}
                        {isInProgress && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/70">
                            In Progress
                          </span>
                        )}
                        {isResolved && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70">
                            Resolved
                          </span>
                        )}
                        {isDismissed && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-[#1E1E1E] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#2A2A2A]">
                            Closed
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-medium text-gray-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                        {formatDateTime(t.created_at)}
                      </span>
                    </div>

                    {/* Submitter Identity & Contact Details */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-500 dark:text-slate-400">
                      <span className="text-xs sm:text-[13px] font-bold text-gray-800 dark:text-slate-100">
                        {t.submitter_name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-[#262626]">
                        {t.submitter_role}
                      </span>
                      <span className="font-mono break-all text-gray-500 dark:text-slate-400">
                        {t.contact_email}
                      </span>
                      {t.lrn && (
                        <span className="font-mono">
                          • LRN: {t.lrn}
                          {t.grade_level ? ` • Grade ${t.grade_level}` : ''}
                          {t.section ? ` • ${t.section}` : ''}
                          {t.tutor_name ? ` • Tutor: ${t.tutor_name}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Problem Description */}
                    <div
                      className={`rounded-lg border px-3 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap ${
                        isDone
                          ? 'border-gray-200/70 dark:border-[#1E1E1E] bg-gray-50/60 dark:bg-[#0E0E0E] text-gray-500 dark:text-slate-400'
                          : 'border-gray-200 dark:border-[#222222] bg-gray-50/70 dark:bg-[#161616] text-gray-800 dark:text-slate-200'
                      }`}
                    >
                      {t.description}
                    </div>

                    {/* Attribution / Notes */}
                    {isInProgress && t.claimed_by_name && (
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        In Progress — Handled by {t.claimed_by_name}
                      </p>
                    )}

                    {isResolved && t.admin_reply && (
                      <div className="rounded-md border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/25 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-300">
                        <strong>Resolution Note:</strong> {t.admin_reply}
                        {(t.resolved_by_name || t.resolved_at) && (
                          <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {t.resolved_by_name ? `Resolved by ${t.resolved_by_name}` : 'Resolved'}
                            {t.resolved_at ? ` • ${formatDateTime(t.resolved_at)}` : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {isDismissed && t.admin_reply && (
                      <div className="rounded-md border border-gray-200 dark:border-[#242424] bg-gray-100/70 dark:bg-[#161616] px-3 py-2 text-xs text-gray-700 dark:text-slate-300">
                        <strong>Closure Note:</strong> {t.admin_reply}
                        {(t.resolved_by_name || t.resolved_at) && (
                          <span className="block text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                            {t.resolved_by_name ? `Closed by ${t.resolved_by_name}` : 'Closed'}
                            {t.resolved_at ? ` • ${formatDateTime(t.resolved_at)}` : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Inline Resolution / Closure Note Drawer */}
                    {isDrawerOpen && activeAction && (
                      <div className="p-3 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50/60 dark:bg-[#151515] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                            {activeAction.type === 'resolve'
                              ? 'Resolution Note (optional or select preset)'
                              : 'Reason for Closing Ticket (required)'}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAction(null);
                              setActionReply('');
                            }}
                            className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
                            aria-label="Cancel action"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {activeAction.type === 'resolve' && (
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_RESOLUTION_NOTES.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setActionReply(preset)}
                                className="px-2 py-1 rounded text-[10.5px] font-semibold border border-gray-200 dark:border-[#282828] bg-white dark:bg-[#161616] text-gray-600 dark:text-slate-300 hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors cursor-pointer"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        )}

                        <textarea
                          rows={2}
                          value={actionReply}
                          onChange={(e) => setActionReply(e.target.value)}
                          placeholder={
                            activeAction.type === 'resolve'
                              ? 'Enter resolution details (leave blank to use default resolved message)...'
                              : 'Provide reason for closing this ticket...'
                          }
                          className="w-full px-3 py-2 rounded-md border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#111111] text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15"
                        />

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              setActiveAction(null);
                              setActionReply('');
                            }}
                            className="px-3 py-1.5 rounded-md border border-gray-200 dark:border-[#262626] text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#1E1E1E] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={handleSubmitActionForm}
                            className={`px-3.5 py-1.5 rounded-md text-xs font-bold text-white cursor-pointer disabled:opacity-50 transition-colors ${
                              activeAction.type === 'resolve'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-slate-700 hover:bg-slate-800'
                            }`}
                          >
                            {isUpdating
                              ? 'Saving...'
                              : activeAction.type === 'resolve'
                              ? 'Confirm & Mark Resolved'
                              : 'Confirm Closure'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tear-Off Action Stub with Perforated Tear Seam & Top/Bottom Notches */}
                  <div
                    className={`relative md:w-48 lg:w-52 shrink-0 border-t md:border-t-0 md:border-l border-dashed border-gray-300 dark:border-[#2A2A2A] ${stubSurface} rounded-b-[11px] md:rounded-bl-none md:rounded-r-[11px] pl-6 md:pl-5 pr-6 sm:pr-7 py-3.5 flex flex-col justify-center`}
                  >
                    <span
                      aria-hidden="true"
                      className="hidden md:block pointer-events-none absolute -top-[1px] -left-2.5 w-5 h-3 overflow-hidden z-10"
                    >
                      <span
                        className={`block w-5 h-5 -mt-2.5 rounded-full bg-[#F8FAFC] dark:bg-[#0B0B0B] border ${ticketBorderColor}`}
                      />
                    </span>
                    <span
                      aria-hidden="true"
                      className="hidden md:block pointer-events-none absolute -bottom-[1px] -left-2.5 w-5 h-3 overflow-hidden z-10"
                    >
                      <span
                        className={`block w-5 h-5 mt-0.5 rounded-full bg-[#F8FAFC] dark:bg-[#0B0B0B] border ${ticketBorderColor}`}
                      />
                    </span>

                    {/* Stub Action Buttons */}
                    <div className="flex flex-wrap md:flex-col items-stretch gap-2">
                      {isPending && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleQuickAction(t.ticket_id, 'claim')}
                          className="px-3 py-1.5 rounded-md text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer disabled:opacity-50 text-center"
                        >
                          Mark In Progress
                        </button>
                      )}

                      {(isPending || isInProgress) && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              setActiveAction({ ticketId: t.ticket_id, type: 'resolve' });
                              setActionReply('');
                            }}
                            className="flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50 text-center"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => {
                              setActiveAction({ ticketId: t.ticket_id, type: 'dismiss' });
                              setActionReply('');
                            }}
                            className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#191919] text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#222222] transition-colors cursor-pointer disabled:opacity-50 text-center"
                          >
                            Close
                          </button>
                        </div>
                      )}

                      {isDone && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleQuickAction(t.ticket_id, 'reopen')}
                          className="px-3 py-1.5 rounded-md text-[11px] font-semibold border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#191919] text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#222222] transition-colors cursor-pointer disabled:opacity-50 text-center"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        <TablePagination
          currentPage={page}
          totalItems={filteredTickets.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="tickets"
        />
        </div>
      </div>

      {/* Floating Notification Toast */}
      {toast.show && (
        <aside
          aria-live="polite"
          className="fixed top-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div
            className={`rounded-lg border p-3.5 shadow-xl bg-white dark:bg-[#111111] ${
              toast.type === 'error'
                ? 'border-rose-200 dark:border-rose-800/60'
                : 'border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3
                className={`text-xs font-bold ${
                  toast.type === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {toast.title}
              </h3>
              <button
                type="button"
                onClick={() => setToast((prev) => ({ ...prev, show: false }))}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer"
                aria-label="Close notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              {toast.message}
            </p>
          </div>
        </aside>
      )}
    </div>
  );
};
