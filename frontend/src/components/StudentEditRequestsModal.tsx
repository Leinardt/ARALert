import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Check, Clock, CheckCircle2,
  XCircle, AlertCircle, RefreshCw
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
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'history'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject state tracking
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const fetchRequests = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setIsLoading(true);
    }
    setActionError(null);
    try {
      const data = await userService.getStudentEditRequests();
      setRequests(data.results || []);
    } catch (err: any) {
      console.error('Failed to load student edit requests:', err);
      setActionError(err.response?.data?.detail || 'Failed to fetch student edit requests.');
    } finally {
      if (showLoadingSpinner) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRequests(true);
      setRejectingId(null);
      setRejectionReason('');
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

  const pendingCount = useMemo(() => {
    return requests.filter((r) => r.status === 'pending').length;
  }, [requests]);

  const historyCount = useMemo(() => {
    return requests.filter((r) => r.status !== 'pending').length;
  }, [requests]);

  const allCount = requests.length;

  const filteredRequests = useMemo(() => {
    if (activeTab === 'pending') {
      return requests.filter((r) => r.status === 'pending');
    }
    if (activeTab === 'history') {
      return requests.filter((r) => r.status !== 'pending');
    }
    return requests;
  }, [requests, activeTab]);

  const paginatedRequests = useMemo(() => {
    return filteredRequests.slice((currentPage - 1) * 30, currentPage * 30);
  }, [filteredRequests, currentPage]);

  const handleApprove = async (request: StudentEditRequest) => {
    const targetLabel = request.request_type === 'staff'
      ? `staff profile for ${request.requested_by_name}`
      : `student records for ${request.student_name || 'student'}`;
    if (!window.confirm(`Are you sure you want to approve changes for ${targetLabel}? This will immediately update the profile.`)) {
      return;
    }

    setProcessingId(request.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await userService.reviewStudentEditRequest(request.id, 'approve');
      setActionSuccess(res.detail || `Successfully approved changes for ${targetLabel}.`);
      await fetchRequests(false);
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
      await fetchRequests(false);
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
    <>
      {/* Backdrop for outside click */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Top-Right Notification Panel */}
      <div
        className="animate-fade-in-scale fixed inset-x-2.5 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[520px] md:w-[560px] max-w-[calc(100vw-20px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
        style={{
          height: 'min(580px, calc(100vh - 90px))',
          maxHeight: 'min(620px, calc(100vh - 90px))',
          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              NOTIFICATIONS
            </h3>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[#0052B7] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            ALL ({allCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-[#0052B7] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            EDIT REQUESTS ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-[#0052B7] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            REQUESTS HISTORY ({historyCount})
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2.5 text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin text-slate-400 dark:text-slate-500" />
              <p className="text-xs font-semibold">Loading notifications...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center gap-2.5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {activeTab === 'pending'
                  ? 'No pending edit requests'
                  : activeTab === 'history'
                  ? 'No requests history found'
                  : 'No edit requests found'}
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                {activeTab === 'pending'
                  ? 'All profiles are up to date. Future edit requests will appear here for review.'
                  : activeTab === 'history'
                  ? 'No completed edit requests in history.'
                  : 'No edit requests have been submitted yet.'}
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'all' && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">ARALert Platform v1.2</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wide">
                        System Update
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                      Oct 24, 2026 • 08:00 AM
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    All system services and academic modules are running normally. Scheduled maintenance windows and system releases are announced here.
                  </p>
                </div>
              )}
              {paginatedRequests.map((req) => {
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
              const isItemRejecting = rejectingId === req.id;

              return (
                <div
                  key={req.id}
                  className={`rounded-xl border transition-all p-3.5 sm:p-4 ${
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
                            <span className="text-[11px] font-mono text-slate-400">
                              {req.current_lrn ? `LRN: ${req.current_lrn}` : 'No LRN'}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {req.request_type === 'staff' ? (
                          <>Submitted for approval</>
                        ) : (
                          <>Requested by <strong className="text-slate-700 dark:text-slate-300 font-semibold">{req.requested_by_name}</strong></>
                        )}
                      </p>
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
                    <table className="w-full min-w-[380px] text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[9px]">
                          <th className="py-1.5 px-2 text-left w-1/4">Field</th>
                          <th className="py-1.5 px-2 text-left w-1/3">Current</th>
                          <th className="py-1.5 px-2 text-left w-1/3">Proposed</th>
                          <th className="py-1.5 px-2 text-center w-16">Status</th>
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
                          <td className="py-1.5 px-2 text-center">
                            {hasFirstNameChanged ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                            ) : (
                              <span className="text-slate-400 text-[9px]">Same</span>
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
                          <td className="py-1.5 px-2 text-center">
                            {hasMiddleNameChanged ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                            ) : (
                              <span className="text-slate-400 text-[9px]">Same</span>
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
                          <td className="py-1.5 px-2 text-center">
                            {hasLastNameChanged ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                            ) : (
                              <span className="text-slate-400 text-[9px]">Same</span>
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
                            <td className="py-1.5 px-2 text-center">
                              {hasLrnChanged ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                              ) : (
                                <span className="text-slate-400 text-[9px]">Same</span>
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
                            <td className="py-1.5 px-2 text-center">
                              {hasLevelChanged ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Changed</span>
                              ) : (
                                <span className="text-slate-400 text-[9px]">Same</span>
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
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                      {isItemRejecting ? (
                        <div className="space-y-2 bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 animate-fade-in">
                          <label className="block text-[11px] font-bold text-rose-900 dark:text-rose-300">
                            Reason for Rejecting Edit Request *
                          </label>
                          <textarea
                            rows={2}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="State reason for rejection..."
                            className="w-full px-2.5 py-1.5 text-xs border border-rose-200 dark:border-rose-800 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
                            autoFocus
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectionReason('');
                              }}
                              disabled={isItemProcessing}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSubmit(req.id)}
                              disabled={isItemProcessing || !rejectionReason.trim()}
                              className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {isItemProcessing ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Rejecting...
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3" /> Confirm Rejection
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(req.id);
                              setRejectionReason('');
                            }}
                            disabled={isItemProcessing}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" /> Reject Request
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(req)}
                            disabled={isItemProcessing}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isItemProcessing ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Approving...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" /> Approve & Update
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </>
          )}
        </div>
      </div>
    </>
  );
};
