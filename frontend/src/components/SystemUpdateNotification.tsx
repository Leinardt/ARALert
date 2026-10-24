import React from 'react';

/**
 * A platform-wide announcement shown in the notifications inbox
 * (e.g. a new release or a scheduled maintenance window).
 */
export interface SystemUpdate {
  id: string;
  title: string;
  description: string;
  /** ISO 8601 timestamp, used for sorting and the date shown on the card. */
  created_at: string;
}

/**
 * System updates currently shown to users. Empty means nothing is shown.
 *
 * To announce something, add an entry here, e.g.:
 * {
 *   id: 'release-v1-3',
 *   title: 'ARALert Platform v1.3',
 *   description: 'Scheduled maintenance on Oct 30, 2026 from 10:00 PM to 11:00 PM.',
 *   created_at: '2026-10-28T08:00:00.000Z',
 * }
 */
export const SYSTEM_UPDATES: SystemUpdate[] = [];

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} • ${time}`;
};

/** Card for a single system update in the notifications inbox. */
export const SystemUpdateNotification: React.FC<{ update: SystemUpdate }> = ({ update }) => (
  <div
    style={{
      background: 'var(--surface-muted)',
      border: '1px solid var(--slate-200)',
      borderRadius: '10px',
      padding: '0.75rem 0.85rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{update.title}</span>
      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {formatTimestamp(update.created_at)}
      </span>
    </div>
    <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
      {update.description}
    </p>
  </div>
);
