import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, Clock, CheckCircle2,
  XCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import type { StudentEditRequest } from '../types';
import { getReviewerLabel } from '../utils/studentFormatters';
import { userService } from '../services/userService';
import { SystemUpdateNotification, SYSTEM_UPDATES } from './SystemUpdateNotification';
import { ticketService, SupportTicketItem } from '../services/ticketService';
import { announcementService, SystemAnnouncementItem } from '../services/announcementService';
import { useAuth } from '../hooks/useAuth';

interface StudentEditRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestReviewed?: () => void;
}

export const StudentEditRequestsModal: React.FC<StudentEditRequestsModalProps> = ({
  isOpen,
  onClose,
  onRequestReviewed,
}) => {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.is_superuser);
  const [requests, setRequests] = useState<StudentEditRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'tickets' | 'announcements' | 'history'>('all');
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [announcements, setAnnouncements] = useState<SystemAnnouncementItem[]>([]);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementMessage, setNewAnnouncementMessage] = useState('');
  const [newAnnouncementType, setNewAnnouncementType] = useState<'INFO' | 'UPDATE' | 'MAINTENANCE'>('INFO');
  const [newAnnouncementTarget, setNewAnnouncementTarget] = useState<'ALL' | 'TUTORS' | 'STUDENTS' | 'PRINCIPALS'>('ALL');
  const [isPublishingAnnouncement, setIsPublishingAnnouncement] = useState(false);
  const [showCreateAnnouncementForm, setShowCreateAnnouncementForm] = useState(false);
  const [activeTicketAction, setActiveTicketAction] = useState<{ ticketId: string; type: 'resolve' | 'dismiss' } | null>(null);
  const [ticketActionReply, setTicketActionReply] = useState<string>('');
  const [isUpdatingTicket, setIsUpdatingTicket] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Confirmation modal states
  const [confirmApproveRequest, setConfirmApproveRequest] = useState<StudentEditRequest | null>(null);
  const [confirmRejectRequest, setConfirmRejectRequest] = useState<StudentEditRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  const fetchRequests = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setIsLoading(true);
    }
    setActionError(null);
    try {
      const [editData, ticketData, announcementData] = await Promise.all([
        userService.getStudentEditRequests(),
        ticketService.getTickets(),
        announcementService.getAnnouncements(),
      ]);
      setRequests(editData.results || []);
      setTickets(ticketData.results || []);
      setPendingTicketsCount(ticketData.pending_count || 0);
      setAnnouncements(announcementData.results || []);
    } catch (err: any) {
      console.error('Failed to load notifications data:', err);
      setActionError(err.response?.data?.detail || 'Failed to fetch notifications.');
    } finally {
      if (showLoadingSpinner) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRequests(true);
      setConfirmApproveRequest(null);
      setConfirmRejectRequest(null);
      setRejectionReason('');
      setRejectionError(null);
      setActionSuccess(null);
      setActionError(null);

      // Auto refresh always while the notification popup is open
      const interval = setInterval(() => {
        fetchRequests(false);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, isOpen]);

  useEffect(() => {
    if (!isSuperAdmin && activeTab === 'tickets') {
      setActiveTab('all');
    }
  }, [isSuperAdmin, activeTab]);

  const activeTickets = useMemo(() => {
    if (!isSuperAdmin) {
      return tickets;
    }
    return tickets.filter((t) => t.status === 'UNDER_REVIEW' || t.status === 'IN_PROGRESS');
  }, [isSuperAdmin, tickets]);

  const historyTickets = useMemo(() => {
    if (!isSuperAdmin) {
      return [];
    }
    return tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'DISMISSED');
  }, [isSuperAdmin, tickets]);

  const pendingCount = useMemo(() => {
    return requests.filter((r) => r.status === 'pending').length;
  }, [requests]);

  const historyCount = useMemo(() => {
    return requests.filter((r) => r.status !== 'pending').length + (isSuperAdmin ? historyTickets.length : 0);
  }, [requests, isSuperAdmin, historyTickets.length]);

  // ALL count represents all active notifications:
  // - Super Admin: pending edit requests + incoming pending tickets + active announcements
  // - School Admin: pending edit requests + own non-dismissed problem reports + active announcements
  const allCount = useMemo(() => {
    const ticketCountForFeed = isSuperAdmin ? pendingTicketsCount : tickets.length;
    return pendingCount + ticketCountForFeed + announcements.length + SYSTEM_UPDATES.length;
  }, [pendingCount, isSuperAdmin, pendingTicketsCount, tickets.length, announcements.length]);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncementTitle.trim() || !newAnnouncementMessage.trim()) {
      setActionError('Title and message are required.');
      return;
    }
    setIsPublishingAnnouncement(true);
    setActionError(null);
    try {
      await announcementService.createAnnouncement({
        title: newAnnouncementTitle.trim(),
        message: newAnnouncementMessage.trim(),
        announcement_type: newAnnouncementType,
        target_role: newAnnouncementTarget,
      });
      setActionSuccess('System announcement published successfully.');
      setNewAnnouncementTitle('');
      setNewAnnouncementMessage('');
      setShowCreateAnnouncementForm(false);
      await fetchRequests(false);
      onRequestReviewed?.();
    } catch (err: any) {
      console.error('Failed to publish announcement', err);
      setActionError(err.response?.data?.error || 'Failed to publish announcement.');
    } finally {
      setIsPublishingAnnouncement(false);
    }
  };

  const handleDeactivateAnnouncement = async (id: string | number) => {
    setActionError(null);
    try {
      await announcementService.deleteAnnouncement(id);
      setActionSuccess('Announcement deactivated.');
      await fetchRequests(false);
      onRequestReviewed?.();
    } catch (err: any) {
      console.error('Failed to deactivate announcement', err);
      setActionError(err.response?.data?.error || 'Failed to deactivate announcement.');
    }
  };

  const handleTicketClaim = async (ticketId: string) => {
    setIsUpdatingTicket(true);
    setActionError(null);
    try {
      await ticketService.updateTicketAction(ticketId, 'claim');
      setActionSuccess(`Ticket #${ticketId} marked as In Progress.`);
      await fetchRequests(false);
      onRequestReviewed?.();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to update ticket status.');
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const handleTicketSubmitResolution = async () => {
    if (!activeTicketAction) return;
    if (!ticketActionReply.trim()) {
      setActionError(activeTicketAction.type === 'resolve' ? 'Resolution note is required.' : 'Dismissal reason is required.');
      return;
    }
    setIsUpdatingTicket(true);
    setActionError(null);
    try {
      await ticketService.updateTicketAction(activeTicketAction.ticketId, activeTicketAction.type, ticketActionReply.trim());
      setActionSuccess(`Ticket #${activeTicketAction.ticketId} ${activeTicketAction.type === 'resolve' ? 'marked as Resolved' : 'dismissed'}.`);
      setActiveTicketAction(null);
      setTicketActionReply('');
      await fetchRequests(false);
      onRequestReviewed?.();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to update ticket.');
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const handleUserDismissOwnTicket = async (ticketId: string) => {
    setIsUpdatingTicket(true);
    setActionError(null);
    try {
      await ticketService.dismissTicketForUser(ticketId);
      await fetchRequests(false);
      onRequestReviewed?.();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to dismiss report notification.');
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  const unifiedFeed = useMemo(() => {
    type FeedItem =
      | { kind: 'ticket'; sortTime: number; ticket: SupportTicketItem }
      | { kind: 'request'; sortTime: number; request: StudentEditRequest };

    if (activeTab === 'tickets') {
      if (!isSuperAdmin) return [];
      return activeTickets.map((t): FeedItem => ({
        kind: 'ticket',
        sortTime: new Date(t.created_at).getTime(),
        ticket: t,
      }));
    }
    if (activeTab === 'pending') {
      return requests
        .filter((r) => r.status === 'pending')
        .map((r): FeedItem => ({
          kind: 'request',
          sortTime: new Date(r.created_at).getTime(),
          request: r,
        }));
    }
    if (activeTab === 'all') {
      const items: FeedItem[] = [
        ...activeTickets.map((t): FeedItem => ({
          kind: 'ticket',
          sortTime: new Date(
            isSuperAdmin ? t.created_at : (t.resolved_at || t.updated_at || t.created_at)
          ).getTime(),
          ticket: t,
        })),
        ...requests
          .filter((r) => r.status === 'pending')
          .map((r): FeedItem => ({
            kind: 'request',
            sortTime: new Date(r.created_at).getTime(),
            request: r,
          })),
      ];
      return items.sort((a, b) => b.sortTime - a.sortTime);
    }
    if (activeTab === 'history') {
      const items: FeedItem[] = [
        ...(isSuperAdmin
          ? historyTickets.map((t): FeedItem => ({
              kind: 'ticket',
              sortTime: new Date(t.resolved_at || t.updated_at || t.created_at).getTime(),
              ticket: t,
            }))
          : []),
        ...requests
          .filter((r) => r.status !== 'pending')
          .map((r): FeedItem => ({
            kind: 'request',
            sortTime: new Date(r.reviewed_at || r.created_at).getTime(),
            request: r,
          })),
      ];
      return items.sort((a, b) => b.sortTime - a.sortTime);
    }
    return [];
  }, [activeTab, isSuperAdmin, activeTickets, historyTickets, requests]);

  const hasItemsToShow =
    activeTab === 'announcements' ||
    unifiedFeed.length > 0 ||
    (activeTab === 'all' && (SYSTEM_UPDATES.length > 0 || announcements.length > 0));

  const paginatedFeed = useMemo(() => {
    return unifiedFeed.slice((currentPage - 1) * 30, currentPage * 30);
  }, [unifiedFeed, currentPage]);

  const handleExecuteApprove = async () => {
    if (!confirmApproveRequest) return;
    const request = confirmApproveRequest;
    const targetLabel = request.request_type === 'staff'
      ? `staff profile for ${request.requested_by_name}`
      : `student records for ${request.student_name || 'student'}`;

    setProcessingId(request.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await userService.reviewStudentEditRequest(request.id, 'approve');
      setActionSuccess(res.detail || `Successfully approved changes for ${targetLabel}.`);
      setConfirmApproveRequest(null);
      await fetchRequests(false);
      onRequestReviewed?.();
    } catch (err: any) {
      console.error('Approval failed:', err);
      setActionError(err.response?.data?.detail || 'Failed to approve the request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleExecuteReject = async () => {
    if (!confirmRejectRequest) return;
    if (!rejectionReason.trim()) {
      setRejectionError('Please provide a reason for rejecting this edit request.');
      return;
    }

    const request = confirmRejectRequest;
    setProcessingId(request.id);
    setActionError(null);
    setActionSuccess(null);
    setRejectionError(null);
    try {
      const res = await userService.reviewStudentEditRequest(request.id, 'reject', rejectionReason.trim());
      setActionSuccess(res.detail || 'Edit request rejected successfully.');
      setConfirmRejectRequest(null);
      setRejectionReason('');
      await fetchRequests(false);
      onRequestReviewed?.();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      setRejectionError(err.response?.data?.detail || 'Failed to reject the request.');
    } finally {
      setProcessingId(null);
    }
  };

  const renderTicketCard = (t: SupportTicketItem) => {
    const isPending = t.status === 'UNDER_REVIEW';
    const isInProgress = t.status === 'IN_PROGRESS';
    const isResolved = t.status === 'RESOLVED';
    const isDismissed = t.status === 'DISMISSED';

    return (
      <div
        key={`admin-tkt-${t.id}`}
        className={`rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs ${
          isResolved
            ? 'bg-slate-50/60 dark:bg-slate-800/40'
            : isDismissed
            ? 'bg-slate-50/40 dark:bg-slate-800/30 opacity-85'
            : 'bg-white dark:bg-slate-900'
        }`}
      >
        <div className="border-b border-slate-100 dark:border-slate-800/80 pb-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
              #{t.ticket_id}
            </span>
            <div className="shrink-0">
              {isPending && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Under Review
                </span>
              )}
              {isInProgress && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  In Progress
                </span>
              )}
              {isResolved && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Resolved
                </span>
              )}
              {isDismissed && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Closed
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.submitter_name}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {t.submitter_role}
              </span>
            </div>

            <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap shrink-0">
              {new Date(t.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })} • {new Date(t.created_at).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono break-all">
            {t.contact_email}
          </p>
        </div>

        {t.lrn && (
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            LRN: {t.lrn} {t.grade_level ? `• Grade: ${t.grade_level}` : ''} {t.section ? `• Section: ${t.section}` : ''} {t.tutor_name ? `• Tutor: ${t.tutor_name}` : ''}
          </div>
        )}

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
          {t.description}
        </div>

        {isInProgress && t.claimed_by_name && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
            Handled by Super Admin: {t.claimed_by_name}
          </p>
        )}

        {isResolved && t.admin_reply && (
          <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300">
            <strong>Resolution Note:</strong> {t.admin_reply}
            {t.resolved_by_name && (
              <span className="block text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                Resolved by: {t.resolved_by_name}
                {t.resolved_at && ` on ${new Date(t.resolved_at).toLocaleDateString()}`}
              </span>
            )}
          </div>
        )}

        {isDismissed && t.admin_reply && (
          <div className="p-2.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
            <strong>Dismissal Reason:</strong> {t.admin_reply}
            {t.resolved_by_name && (
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Closed by: {t.resolved_by_name}
                {t.resolved_at && ` on ${new Date(t.resolved_at).toLocaleDateString()}`}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons: Dismiss, Mark In Progress, Resolve Ticket */}
        {isSuperAdmin && (isPending || isInProgress) && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={isUpdatingTicket}
              onClick={() => {
                setActiveTicketAction({ ticketId: t.ticket_id, type: 'dismiss' });
                setTicketActionReply('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Dismiss
            </button>

            {isPending && (
              <button
                type="button"
                disabled={isUpdatingTicket}
                onClick={() => handleTicketClaim(t.ticket_id)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition cursor-pointer"
              >
                Mark In Progress
              </button>
            )}

            <button
              type="button"
              disabled={isUpdatingTicket}
              onClick={() => {
                setActiveTicketAction({ ticketId: t.ticket_id, type: 'resolve' });
                setTicketActionReply('');
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
            >
              Resolve Ticket
            </button>
          </div>
        )}

        {/* Inline Reply / Resolution Input Drawer */}
        {isSuperAdmin && activeTicketAction?.ticketId === t.ticket_id && (
          <div className="mt-3 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/60 space-y-2.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              {activeTicketAction.type === 'resolve' ? 'Resolution Note (Sent to Submitter)' : 'Reason for Dismissal'}
            </label>
            <textarea
              rows={3}
              value={ticketActionReply}
              onChange={(e) => setTicketActionReply(e.target.value)}
              placeholder={activeTicketAction.type === 'resolve' ? 'Explain how the issue was resolved or fixed...' : 'Provide reason for closing this ticket...'}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isUpdatingTicket}
                onClick={() => setActiveTicketAction(null)}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingTicket}
                onClick={handleTicketSubmitResolution}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition cursor-pointer disabled:opacity-50 ${
                  activeTicketAction.type === 'resolve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                {isUpdatingTicket ? 'Submitting...' : (activeTicketAction.type === 'resolve' ? 'Send Resolution & Mark Resolved' : 'Submit Dismissal')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSubmittedTicketCard = (t: SupportTicketItem) => {
    const isPending = t.status === 'UNDER_REVIEW';
    const isInProgress = t.status === 'IN_PROGRESS';
    const isResolved = t.status === 'RESOLVED';
    const isDismissed = t.status === 'DISMISSED';

    return (
      <div
        key={`own-tkt-${t.id}`}
        className={`rounded-xl border p-3.5 sm:p-4 space-y-2.5 shadow-xs ${
          isResolved
            ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/20'
            : isInProgress
            ? 'border-amber-200 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/20'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
              Ticket #{t.ticket_id}
            </span>
            <div>
              {isPending && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Under Review
                </span>
              )}
              {isInProgress && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  In Progress
                </span>
              )}
              {isResolved && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Resolved
                </span>
              )}
              {isDismissed && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Closed
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
            {new Date(t.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })} • {new Date(t.created_at).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
          {t.description}
        </div>

        {isPending && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Your problem report has been logged and is pending review by the Super Admin team.
          </p>
        )}

        {isInProgress && (
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            A Super Admin is actively investigating this report.{t.claimed_by_name ? ` (Handled by: ${t.claimed_by_name})` : ''}
          </p>
        )}

        {isResolved && t.admin_reply && (
          <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300">
            <strong>Super Admin Response:</strong> {t.admin_reply}{t.resolved_by_name ? ` — by ${t.resolved_by_name}` : ''}
          </div>
        )}

        {isDismissed && t.admin_reply && (
          <div className="p-2.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
            <strong>Admin Note:</strong> {t.admin_reply}
          </div>
        )}

        {(isResolved || isDismissed) && (
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              disabled={isUpdatingTicket}
              onClick={() => handleUserDismissOwnTicket(t.ticket_id)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for outside click */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Top-Right Notification Panel */}
      <div
        className="animate-fade-in-scale fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[560px] md:w-[600px] max-w-[calc(100vw-20px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
        style={{
          height: 'min(580px, calc(100vh - 90px))',
          maxHeight: 'min(620px, calc(100vh - 90px))',
          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 flex-shrink-0">
          <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Notifications
          </p>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div
          className="no-scrollbar px-5 pb-2.5 bg-white dark:bg-slate-900 flex items-center gap-1 overflow-x-auto flex-nowrap flex-shrink-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            style={{
              padding: '3px 7px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              background: activeTab === 'all' ? '#0052B7' : 'var(--slate-100)',
              color: activeTab === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            ALL ({allCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '3px 7px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              background: activeTab === 'pending' ? '#0052B7' : 'var(--slate-100)',
              color: activeTab === 'pending' ? '#FFFFFF' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            EDIT REQUESTS ({pendingCount})
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              style={{
                padding: '3px 7px',
                borderRadius: '6px',
                fontSize: '0.68rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                background: activeTab === 'tickets' ? '#0052B7' : 'var(--slate-100)',
                color: activeTab === 'tickets' ? '#FFFFFF' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              TICKETS ({pendingTicketsCount})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            style={{
              padding: '3px 7px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              background: activeTab === 'announcements' ? '#0052B7' : 'var(--slate-100)',
              color: activeTab === 'announcements' ? '#FFFFFF' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            ANNOUNCEMENTS ({announcements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              padding: '3px 7px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              background: activeTab === 'history' ? '#0052B7' : 'var(--slate-100)',
              color: activeTab === 'history' ? '#FFFFFF' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            HISTORY ({historyCount})
          </button>
        </div>

        {/* Action Alerts */}
        {actionSuccess && (
          <div className="mx-4 sm:mx-5 mt-2.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 flex-shrink-0">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button type="button" onClick={() => setActionSuccess(null)} className="p-1 hover:text-emerald-950 dark:hover:text-emerald-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="mx-4 sm:mx-5 mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-800 dark:text-rose-300 flex-shrink-0">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button type="button" onClick={() => setActionError(null)} className="p-1 hover:text-rose-950 dark:hover:text-rose-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-3.5">
          {isLoading ? (
            <div className="space-y-3 animate-pulse p-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-4 w-16 rounded bg-gray-100 dark:bg-gray-800" />
                  </div>
                  <div className="h-3 w-48 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-2.5 w-24 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : !hasItemsToShow ? (
            <div className="py-14 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'tickets'
                  ? 'No active support tickets'
                  : activeTab === 'pending'
                  ? 'No pending edit requests'
                  : activeTab === 'history'
                  ? 'No history found'
                  : 'No active notifications'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                {activeTab === 'tickets'
                  ? 'All problem reports have been addressed. Completed tickets are stored in History.'
                  : activeTab === 'pending'
                  ? 'All profiles are up to date. Future edit requests will appear here for review.'
                  : activeTab === 'history'
                  ? (isSuperAdmin
                      ? 'Completed edit requests and resolved or closed tickets will appear here.'
                      : 'Completed edit requests will appear here.')
                  : (isSuperAdmin
                      ? 'All profiles and systems are up to date. Future edit requests, tickets, and updates will appear here.'
                      : 'All profiles and systems are up to date. Future edit requests and updates will appear here.')}
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'all' && (
                <>
                  {SYSTEM_UPDATES.map((u) => <SystemUpdateNotification key={u.id} update={u} />)}
                  {announcements.map((a) => (
                    <div
                      key={`superadmin-all-ann-${a.id}`}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {a.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            {a.announcement_type_display}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {a.message}
                      </p>
                    </div>
                  ))}
                </>
              )}

              {activeTab === 'announcements' && (
                <div className="space-y-4">
                  {/* Create Announcement Box */}
                  {isSuperAdmin && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                          Create System Announcement
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowCreateAnnouncementForm((prev) => !prev)}
                          className="text-xs font-bold text-[#0052B7] dark:text-blue-400 cursor-pointer"
                        >
                          {showCreateAnnouncementForm ? 'Cancel' : '+ New Announcement'}
                        </button>
                      </div>

                      {showCreateAnnouncementForm && (
                        <form onSubmit={handlePublishAnnouncement} className="space-y-3 pt-2">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Announcement Title
                            </label>
                            <input
                              type="text"
                              value={newAnnouncementTitle}
                              onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                              placeholder="e.g. Scheduled Maintenance, Platform Update v2.0"
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0052B7]/20"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Type
                              </label>
                              <select
                                value={newAnnouncementType}
                                onChange={(e) => setNewAnnouncementType(e.target.value as any)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0052B7]/20"
                              >
                                <option value="INFO">Information</option>
                                <option value="UPDATE">Platform Update</option>
                                <option value="MAINTENANCE">Scheduled Maintenance</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Target Audience
                              </label>
                              <select
                                value={newAnnouncementTarget}
                                onChange={(e) => setNewAnnouncementTarget(e.target.value as any)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0052B7]/20"
                              >
                                <option value="ALL">All Users</option>
                                <option value="TUTORS">Tutors & Faculty</option>
                                <option value="STUDENTS">Students</option>
                                <option value="PRINCIPALS">Principals</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Message
                            </label>
                            <textarea
                              rows={3}
                              value={newAnnouncementMessage}
                              onChange={(e) => setNewAnnouncementMessage(e.target.value)}
                              placeholder="Write the full announcement or update details..."
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0052B7]/20"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowCreateAnnouncementForm(false)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isPublishingAnnouncement}
                              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#0052B7] text-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                            >
                              {isPublishingAnnouncement ? 'Publishing...' : 'Publish Announcement'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Active Announcements List */}
                  <div className="space-y-3">
                    {announcements.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400">
                        {isSuperAdmin
                          ? "No active system announcements. Click '+ New Announcement' to publish one."
                          : 'No active system announcements.'}
                      </p>
                    ) : (
                      announcements.map((a) => (
                        <div
                          key={`superadmin-ann-${a.id}`}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                {a.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                  a.announcement_type === 'MAINTENANCE'
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                    : a.announcement_type === 'UPDATE'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                }`}>
                                  {a.announcement_type_display}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  Target: {a.target_role_display}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[10px] font-semibold text-slate-400">
                                {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeactivateAnnouncement(a.id)}
                                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {a.message}
                          </p>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Published by: {a.created_by_name}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab !== 'announcements' && paginatedFeed.map((item) => {
              if (item.kind === 'ticket') {
                return isSuperAdmin
                  ? renderTicketCard(item.ticket)
                  : renderSubmittedTicketCard(item.ticket);
              }
              const req = item.request;
              const isPending = req.status === 'pending';
              const isApproved = req.status === 'approved';
              const isRejected = req.status === 'rejected';

              const isStaff = req.request_type === 'staff';
              const hasFirstNameChanged = (req.current_first_name || '').trim().toUpperCase() !== (req.proposed_first_name || '').trim().toUpperCase();
              const hasMiddleNameChanged = (req.current_middle_name || '').trim().toUpperCase() !== (req.proposed_middle_name || '').trim().toUpperCase();
              const hasLastNameChanged = (req.current_last_name || '').trim().toUpperCase() !== (req.proposed_last_name || '').trim().toUpperCase();
              const hasLrnChanged = !isStaff && (req.current_lrn || '').trim() !== (req.proposed_lrn || '').trim();
              const hasLevelChanged = !isStaff && !!req.proposed_aral_level && (req.current_aral_level || '').toLowerCase() !== (req.proposed_aral_level || '').toLowerCase();

              const changesCount = [
                hasFirstNameChanged,
                hasMiddleNameChanged,
                hasLastNameChanged,
                hasLrnChanged,
                hasLevelChanged,
              ].filter(Boolean).length;

              const isItemProcessing = processingId === req.id;

              return (
                <div
                  key={req.id}
                  className={`rounded-xl border transition-all p-3 sm:p-4 ${
                    isPending
                      ? 'bg-white dark:bg-slate-900 border-black dark:border-slate-700'
                      : isApproved
                      ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      : 'bg-slate-50/40 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-80'
                  }`}
                >
                  {/* Card Top Details */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {req.request_type === 'staff' ? (
                          <>
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {req.requested_by_name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 uppercase tracking-wide">
                              {req.requested_by_role || 'Staff'} Profile Edit
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {req.student_name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 uppercase tracking-wide">
                              Student Profile Edit
                            </span>
                          </>
                        )}
                      </div>
                      {req.request_type !== 'staff' &&
                      req.requested_by_name &&
                      req.student_name &&
                      req.requested_by_name.trim().toLowerCase() !== req.student_name.trim().toLowerCase() && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Requested by <strong className="text-slate-700 dark:text-slate-300 font-semibold">{req.requested_by_name}</strong>
                          {req.requested_by_role && <span className="text-slate-400"> ({req.requested_by_role})</span>}
                        </p>
                      )}
                    </div>

                    {/* Upper Right: Date/Time & Status */}
                    <div className="flex flex-col sm:items-end gap-1 shrink-0">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {new Date(req.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })} • {new Date(req.created_at).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {changesCount} field{changesCount !== 1 ? 's' : ''} modified
                        </span>
                        {isPending && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Pending
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Approved
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Comparison Table */}
                  <div className="mt-2.5 overflow-x-auto mobile-scroll-table">
                    <table className="w-full text-[10.5px] sm:text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[9px]">
                          <th className="py-1.5 px-2 text-left w-[28%]">Field</th>
                          <th className="py-1.5 px-2 text-left w-[36%]">Before</th>
                          <th className="py-1.5 px-2 text-left w-[36%]">After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {/* First Name */}
                        <tr className={hasFirstNameChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                          <td className="py-1.5 px-2 font-semibold text-slate-600 dark:text-slate-400">First Name</td>
                          <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300">{req.current_first_name || '—'}</td>
                          <td className="py-1.5 px-2">
                            {hasFirstNameChanged ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{req.proposed_first_name}</span>
                            ) : (
                              <span className="text-slate-400">{req.proposed_first_name}</span>
                            )}
                          </td>
                        </tr>

                        {/* Middle Name */}
                        <tr className={hasMiddleNameChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                          <td className="py-1.5 px-2 font-semibold text-slate-600 dark:text-slate-400">Middle Name</td>
                          <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300">{req.current_middle_name || '—'}</td>
                          <td className="py-1.5 px-2">
                            {hasMiddleNameChanged ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{req.proposed_middle_name || '(Cleared)'}</span>
                            ) : (
                              <span className="text-slate-400">{req.proposed_middle_name || '—'}</span>
                            )}
                          </td>
                        </tr>

                        {/* Last Name */}
                        <tr className={hasLastNameChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                          <td className="py-1.5 px-2 font-semibold text-slate-600 dark:text-slate-400">Last Name</td>
                          <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300">{req.current_last_name || '—'}</td>
                          <td className="py-1.5 px-2">
                            {hasLastNameChanged ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{req.proposed_last_name}</span>
                            ) : (
                              <span className="text-slate-400">{req.proposed_last_name}</span>
                            )}
                          </td>
                        </tr>

                        {/* LRN (Student Only) */}
                        {req.request_type !== 'staff' && (
                          <tr className={hasLrnChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                            <td className="py-1.5 px-2 font-semibold text-slate-600 dark:text-slate-400">LRN (12 digits)</td>
                            <td className="py-1.5 px-2 font-mono text-slate-700 dark:text-slate-300">{req.current_lrn || '—'}</td>
                            <td className="py-1.5 px-2 font-mono">
                              {hasLrnChanged ? (
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">{req.proposed_lrn || '(Cleared)'}</span>
                              ) : (
                                <span className="text-slate-400">{req.proposed_lrn || '—'}</span>
                              )}
                            </td>
                          </tr>
                        )}

                        {/* ARAL Level (Student Only) */}
                        {req.request_type !== 'staff' && (
                          <tr className={hasLevelChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                            <td className="py-1.5 px-2 font-semibold text-slate-600 dark:text-slate-400">ARAL Level</td>
                            <td className="py-1.5 px-2 capitalize text-slate-700 dark:text-slate-300">{req.current_aral_level || '—'}</td>
                            <td className="py-1.5 px-2 capitalize">
                              {hasLevelChanged ? (
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{req.proposed_aral_level}</span>
                              ) : (
                                <span className="text-slate-400">{req.proposed_aral_level}</span>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Review History Details (if already reviewed) */}
                  {!isPending && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div>
                        {isApproved ? 'Approved' : 'Rejected'} by <strong className="text-slate-700 dark:text-slate-300 font-semibold">{getReviewerLabel(req)}</strong>
                        {req.reviewed_at && ` on ${new Date(req.reviewed_at).toLocaleDateString()}`}
                      </div>
                      {isRejected && req.rejection_reason && (
                        <div className="text-rose-600 dark:text-rose-400 font-medium">
                          Reason: <span className="italic font-normal text-slate-700 dark:text-slate-300">"{req.rejection_reason}"</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Review Action Bar (Pending only) */}
                  {isPending && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmRejectRequest(req);
                          setRejectionReason('');
                          setRejectionError(null);
                        }}
                        disabled={isItemProcessing}
                        className="flex-1 sm:flex-initial justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                      >
                        <span className="sm:hidden">Reject</span>
                        <span className="hidden sm:inline">Reject Request</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmApproveRequest(req)}
                        disabled={isItemProcessing}
                        className="flex-1 sm:flex-initial justify-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                      >
                        {isItemProcessing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Approving...
                          </>
                        ) : (
                          <>
                            <span className="sm:hidden">Approve</span>
                            <span className="hidden sm:inline">Approve & Update</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            </>
          )}
        </div>
      </div>

      {/* ── APPROVE CONFIRMATION MODAL ── */}
      {confirmApproveRequest &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => !processingId && setConfirmApproveRequest(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-sm rounded-3xl p-6 border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-2xl space-y-4 animate-fade-in-scale"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 leading-tight">
                  Approve Edit Request?
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                  Are you sure you want to approve changes for{' '}
                  <strong className="text-gray-900 dark:text-slate-100 font-bold">
                    {confirmApproveRequest.request_type === 'staff'
                      ? `staff profile for ${confirmApproveRequest.requested_by_name}`
                      : `student records for ${confirmApproveRequest.student_name || 'student'}`}
                  </strong>
                  ? This will immediately update the profile.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
                <button
                  type="button"
                  disabled={Boolean(processingId)}
                  onClick={() => setConfirmApproveRequest(null)}
                  className="rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(processingId)}
                  onClick={handleExecuteApprove}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {processingId === confirmApproveRequest.id ? 'Approving...' : 'Yes, Approve & Update'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── REJECT CONFIRMATION MODAL ── */}
      {confirmRejectRequest &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => !processingId && setConfirmRejectRequest(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-sm rounded-3xl p-6 border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] shadow-2xl space-y-4 animate-fade-in-scale"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 leading-tight">
                  Reject Edit Request?
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                  Are you sure you want to reject the edit request for{' '}
                  <strong className="text-gray-900 dark:text-slate-100 font-bold">
                    {confirmRejectRequest.request_type === 'staff'
                      ? `staff profile for ${confirmRejectRequest.requested_by_name}`
                      : `student records for ${confirmRejectRequest.student_name || 'student'}`}
                  </strong>
                  ? Please provide a reason for the rejection.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                  Reason for Rejection *
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionError) setRejectionError(null);
                  }}
                  placeholder="State reason for rejection..."
                  className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-[#1A1A1A] rounded-xl bg-gray-50/50 dark:bg-[#111111] text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                  autoFocus
                />
                {rejectionError && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {rejectionError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
                <button
                  type="button"
                  disabled={Boolean(processingId)}
                  onClick={() => {
                    setConfirmRejectRequest(null);
                    setRejectionError(null);
                  }}
                  className="rounded-xl border border-gray-200 dark:border-[#1A1A1A] bg-white dark:bg-[#111111] px-4 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-[#1A1A1A] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(processingId) || !rejectionReason.trim()}
                  onClick={handleExecuteReject}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {processingId === confirmRejectRequest.id ? 'Rejecting...' : 'Yes, Reject Request'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
