import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ticketService } from '../services/ticketService';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student' || user?.email?.endsWith('@aralert.local');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ ticketId: string; email: string; emailSent: boolean } | null>(null);

  // Helper to format submitter display name as: First Name, Middle Initial, Last Name
  const getFormattedSubmitterName = () => {
    if (!user) return '';
    const first = (user.first_name || '').trim();
    const last = (user.last_name || '').trim();
    const middle = (user.middle_name || '').trim();
    const mi = middle ? `${middle[0].toUpperCase()}.` : '';

    if (first && last) {
      return mi ? `${first} ${mi} ${last}` : `${first} ${last}`;
    }
    if (user.full_name) {
      return user.full_name.trim();
    }
    return first || last || user.username || '';
  };

  useEffect(() => {
    if (isOpen) {
      setName(getFormattedSubmitterName());
      if (!isStudent && user?.email && !user.email.endsWith('@aralert.local')) {
        setEmail(user.email);
      } else {
        setEmail('');
      }
      setDescription('');
      setErrorMessage(null);
      setSuccessData(null);
      setIsSubmitting(false);
    }
  }, [isOpen, user, isStudent]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanDesc = description.trim();

    if (!cleanName) {
      setErrorMessage('Please enter your name.');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Please provide a valid contact email address.');
      return;
    }

    if (!cleanDesc) {
      setErrorMessage('Please provide a description of the issue encountered.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ticketService.submitProblemReport({
        name: cleanName,
        email: cleanEmail,
        description: cleanDesc,
      });
      setSuccessData({
        ticketId: res.ticket_id,
        email: res.contact_email,
        emailSent: Boolean(res.email_sent),
      });
    } catch (err: any) {
      const detail =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to submit the problem report. Please try again.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0E0E0E] rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-problem-title"
      >
        {/* Top Accent Stripe */}
        <div className="h-1.5 w-full bg-[var(--brand)]" />

        {/* Header */}
        <div className="px-6 py-4 border-b border-dashed border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/40">
          <h2 id="report-problem-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            Report a Problem
          </h2>
          {isStudent && user?.lrn && (
            <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
              LRN: {user.lrn}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          {successData ? (
            <div className="space-y-4 py-1">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200/80 dark:border-emerald-800/40 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Ticket Submitted
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-600 text-white">
                    {successData.emailSent ? 'Dispatched' : 'Logged'}
                  </span>
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-400">
                    Reference ID
                  </div>
                  <div className="text-lg font-mono font-extrabold text-emerald-950 dark:text-emerald-200 tracking-wide mt-0.5">
                    {successData.ticketId}
                  </div>
                </div>

                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed pt-1">
                  {successData.emailSent ? (
                    <>
                      Your report has been logged in ARALert and a confirmation receipt has been sent to{' '}
                      <span className="font-mono font-semibold">{successData.email}</span>. Status updates will appear in your Notification, and administrators may also reply to that address if follow-up is needed.
                    </>
                  ) : (
                    <>
                      Your report has been logged in ARALert for Super Admin review. You can monitor status updates and resolutions directly from your Notification, and follow-up correspondence can be sent to{' '}
                      <span className="font-mono font-semibold">{successData.email}</span>.
                    </>
                  )}
                </p>
              </div>

              <div className="border-t border-dashed border-slate-200 dark:border-neutral-800 pt-3 flex items-center justify-start">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--brand)] text-white hover:opacity-90 transition cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Submitter Name Input (Editable, auto-filled) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="ticket-submitter" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Name
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    {user?.is_superuser ? 'Super Admin' : (user?.role || 'User').toUpperCase()}
                  </span>
                </div>
                <input
                  id="ticket-submitter"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=""
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#121212] text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] transition font-medium"
                />
              </div>

              {/* Contact Email Input */}
              <div className="space-y-1.5">
                <label htmlFor="ticket-email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Contact Email
                </label>
                <input
                  id="ticket-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=""
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#121212] text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] transition font-medium"
                />
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  We will communicate through this email if follow-up is needed.
                </p>
              </div>

              {/* Description of Issue Textarea */}
              <div className="space-y-1.5">
                <label htmlFor="ticket-description" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Description of Issue
                </label>
                <textarea
                  id="ticket-description"
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide a clear and detailed description of the problem encountered..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#121212] text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] transition resize-none leading-relaxed"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              {/* Actions */}
              <div className="border-t border-dashed border-slate-200 dark:border-neutral-800 pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--brand)] text-white hover:opacity-90 transition cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
