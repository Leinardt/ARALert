import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Check, AlertTriangle, ShieldCheck, Clock, CheckCircle2,
  XCircle, ArrowRight, Bell, MessageSquare, AlertCircle, RefreshCw
} from 'lucide-react';
import type { StudentEditRequest } from '../types';
import { userService } from '../services/userService';

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
  const [requests, setRequests] = useState<StudentEditRequest[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject state tracking
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const fetchRequests = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await userService.getStudentEditRequests();
      setRequests(data.results || []);
      setPendingCount(data.pending_count ?? data.results.filter(r => r.status === 'pending').length);
    } catch (err: any) {
      console.error('Failed to load student edit requests:', err);
      setActionError(err.response?.data?.detail || 'Failed to fetch student edit requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
      setRejectingId(null);
      setRejectionReason('');
      setActionSuccess(null);
      setActionError(null);
    }
  }, [isOpen]);

  const filteredRequests = useMemo(() => {
    if (activeTab === 'pending') {
      return requests.filter((r) => r.status === 'pending');
    }
    return requests;
  }, [requests, activeTab]);

  const handleApprove = async (request: StudentEditRequest) => {
    if (!window.confirm(`Are you sure you want to approve changes for ${request.student_name}? This will immediately update the official student records.`)) {
      return;
    }

    setProcessingId(request.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await userService.reviewStudentEditRequest(request.id, 'approve');
      setActionSuccess(res.detail || `Successfully approved changes for ${request.student_name}.`);
      await fetchRequests();
      onRequestReviewed?.();
    } catch (err: any) {
      console.error('Approval failed:', err);
      setActionError(err.response?.data?.detail || 'Failed to approve the request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (requestId: string) => {
    if (!rejectionReason.trim()) {
      setActionError('Please provide a reason for rejecting this edit request.');
      return;
    }

    setProcessingId(requestId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await userService.reviewStudentEditRequest(requestId, 'reject', rejectionReason.trim());
      setActionSuccess(res.detail || 'Edit request rejected successfully.');
      setRejectingId(null);
      setRejectionReason('');
      await fetchRequests();
      onRequestReviewed?.();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      setActionError(err.response?.data?.detail || 'Failed to reject the request.');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-5 backdrop-blur-sm animate-fade-in"
      style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="relative w-full max-w-4xl h-[92vh] sm:h-[90vh] max-h-[850px] rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-xs shrink-0">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  EDIT REQUESTS
                </h3>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-500 text-white shadow-xs">
                    {pendingCount} Pending
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1 sm:line-clamp-none">
                Review and approve tutor-submitted edits before official database records are updated
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchRequests}
              disabled={isLoading}
              className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Refresh requests"
              aria-label="Refresh requests"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin text-[var(--brand)]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection & Notices */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Pending Approval ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[var(--brand)] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All History ({requests.length})
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Integrity Guard: Direct tutor profile tampering is blocked</span>
          </div>
        </div>

        {/* Action Alerts */}
        {actionSuccess && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button type="button" onClick={() => setActionSuccess(null)} className="p-1 hover:text-emerald-950">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button type="button" onClick={() => setActionError(null)} className="p-1 hover:text-rose-950">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-[var(--brand)]" />
              <p className="text-xs font-semibold">Loading student edit requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'pending' ? 'No pending student edit requests' : 'No student edit history found'}
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                {activeTab === 'pending'
                  ? 'All student profiles are verified. Any future edit requests submitted by tutors will appear here for review.'
                  : 'No edit requests have been submitted yet.'}
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isPending = req.status === 'pending';
              const isApproved = req.status === 'approved';
              const isRejected = req.status === 'rejected';

              const hasFirstNameChanged = req.current_first_name !== req.proposed_first_name;
              const hasMiddleNameChanged = (req.current_middle_name || '') !== (req.proposed_middle_name || '');
              const hasLastNameChanged = req.current_last_name !== req.proposed_last_name;
              const hasLrnChanged = (req.current_lrn || '') !== (req.proposed_lrn || '');
              const hasLevelChanged = req.current_aral_level?.toLowerCase() !== req.proposed_aral_level?.toLowerCase();

              const changesCount = [
                hasFirstNameChanged,
                hasMiddleNameChanged,
                hasLastNameChanged,
                hasLrnChanged,
                hasLevelChanged,
              ].filter(Boolean).length;

              const isItemProcessing = processingId === req.id;
              const isItemRejecting = rejectingId === req.id;

              return (
                <div
                  key={req.id}
                  className={`rounded-md border transition-all p-5 ${
                    isPending
                      ? 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/60 ring-1 ring-amber-400/20'
                      : isApproved
                      ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      : 'bg-slate-50/40 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-80'
                  }`}
                >
                  {/* Card Top Details */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                          {req.student_name}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {req.current_lrn ? `LRN: ${req.current_lrn}` : 'No LRN'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Requested by <strong className="text-slate-700 dark:text-slate-300 font-semibold">{req.requested_by_name}</strong> •{' '}
                        {new Date(req.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-400">
                        {changesCount} field{changesCount !== 1 ? 's' : ''} modified
                      </span>
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Clock className="w-3.5 h-3.5" /> Pending Review
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          <XCircle className="w-3.5 h-3.5" /> Rejected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tutor's Reason */}
                  <div className="mt-3.5 p-3 rounded-md bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-xs">
                    <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5 text-[11px] uppercase tracking-wider">
                      Tutor's Stated Reason:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 italic">
                      "{req.reason}"
                    </p>
                  </div>

                  {/* Side-by-Side Comparison Table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[460px] text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2 px-3 text-left w-1/4">Field</th>
                          <th className="py-2 px-3 text-left w-1/3">Current Value</th>
                          <th className="py-2 px-3 text-left w-1/3">Proposed Value</th>
                          <th className="py-2 px-3 text-center w-20">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {/* First Name */}
                        <tr className={hasFirstNameChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                          <td className="py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">First Name</td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{req.current_first_name || '—'}</td>
                          <td className="py-2 px-3">
                            {hasFirstNameChanged ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{req.proposed_first_name}</span>
                            ) : (
                              <span className="text-slate-400">{req.proposed_first_name}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {hasFirstNameChanged ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Same</span>
                            )}
                          </td>
                        </tr>

                        {/* Middle Name */}
                        <tr className={hasMiddleNameChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                          <td className="py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Middle Name</td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{req.current_middle_name || '—'}</td>
                          <td className="py-2 px-3">
                            {hasMiddleNameChanged ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{req.proposed_middle_name || '(Cleared)'}</span>
                            ) : (
                              <span className="text-slate-400">{req.proposed_middle_name || '—'}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {hasMiddleNameChanged ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Same</span>
                            )}
                          </td>
                        </tr>

                        {/* Last Name */}
                        <tr className={hasLastNameChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                          <td className="py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">Last Name</td>
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{req.current_last_name || '—'}</td>
                          <td className="py-2 px-3">
                            {hasLastNameChanged ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{req.proposed_last_name}</span>
                            ) : (
                              <span className="text-slate-400">{req.proposed_last_name}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {hasLastNameChanged ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Same</span>
                            )}
                          </td>
                        </tr>

                        {/* LRN */}
                        <tr className={hasLrnChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                          <td className="py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">LRN (12 digits)</td>
                          <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">{req.current_lrn || '—'}</td>
                          <td className="py-2 px-3 font-mono">
                            {hasLrnChanged ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{req.proposed_lrn || '(Cleared)'}</span>
                            ) : (
                              <span className="text-slate-400">{req.proposed_lrn || '—'}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {hasLrnChanged ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Same</span>
                            )}
                          </td>
                        </tr>

                        {/* ARAL Level */}
                        <tr className={hasLevelChanged ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''}>
                          <td className="py-2 px-3 font-semibold text-slate-600 dark:text-slate-400">ARAL Level</td>
                          <td className="py-2 px-3 capitalize text-slate-700 dark:text-slate-300">{req.current_aral_level || '—'}</td>
                          <td className="py-2 px-3 capitalize">
                            {hasLevelChanged ? (
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{req.proposed_aral_level}</span>
                            ) : (
                              <span className="text-slate-400">{req.proposed_aral_level}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {hasLevelChanged ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Same</span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Review History Details (if already reviewed) */}
                  {!isPending && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        Reviewed by <strong className="text-slate-700 dark:text-slate-300 font-semibold">{req.reviewed_by_name || 'Admin'}</strong>
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
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      {isItemRejecting ? (
                        <div className="space-y-2.5 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 animate-fade-in">
                          <label className="block text-xs font-bold text-rose-900 dark:text-rose-300">
                            Reason for Rejecting Edit Request *
                          </label>
                          <textarea
                            rows={2}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="State reason for rejection (e.g., LRN does not match school registry, incorrect student spelling, contact school office)..."
                            className="w-full px-3 py-2 text-xs border border-rose-200 dark:border-rose-800 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectionReason('');
                              }}
                              disabled={isItemProcessing}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSubmit(req.id)}
                              disabled={isItemProcessing || !rejectionReason.trim()}
                              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {isItemProcessing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rejecting...
                                </>
                              ) : (
                                <>
                                  <X className="w-3.5 h-3.5" /> Confirm Rejection
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(req.id);
                              setRejectionReason('');
                            }}
                            disabled={isItemProcessing}
                            className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" /> Reject Request
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(req)}
                            disabled={isItemProcessing}
                            className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isItemProcessing ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Approving...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" /> Approve & Update Records
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex-shrink-0 text-xs">
          <span className="text-slate-400">
            Approved changes directly modify the student's User and Academic profile.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
