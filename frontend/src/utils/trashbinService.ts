/**
 * Service to manage soft-deleted / trashbin record entries for scores and attendance.
 * Keeps entries in trashbin for 30 days before permanent deletion.
 */

export interface TrashbinEntry {
  type: 'score' | 'attendance';
  tutorId: number | string;
  date: string;
  recordIds: number[];
  trashedAt: number; // timestamp in ms
}

const TRASHBIN_STORAGE_KEY_PREFIX = 'aralert_trashbin_';
const RETENTION_DAYS = 30;

const getStorageKey = (type: 'score' | 'attendance', tutorId?: number | string): string => {
  return `${TRASHBIN_STORAGE_KEY_PREFIX}${tutorId || 'global'}_${type}`;
};

export const trashbinService = {
  getEntries: (type: 'score' | 'attendance', tutorId?: number | string): Record<string, TrashbinEntry> => {
    try {
      const key = getStorageKey(type, tutorId);
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse trashbin entries:', e);
      return {};
    }
  },

  isDateTrashed: (type: 'score' | 'attendance', date: string, tutorId?: number | string): boolean => {
    if (!date) return false;
    const dateKey = date.slice(0, 10);
    const entries = trashbinService.getEntries(type, tutorId);
    const entry = entries[dateKey];
    if (!entry) return false;
    const elapsedDays = Math.floor((Date.now() - entry.trashedAt) / (1000 * 60 * 60 * 24));
    return elapsedDays < RETENTION_DAYS;
  },

  getTrashedEntry: (type: 'score' | 'attendance', date: string, tutorId?: number | string): TrashbinEntry | null => {
    if (!date) return null;
    const dateKey = date.slice(0, 10);
    const entries = trashbinService.getEntries(type, tutorId);
    return entries[dateKey] || null;
  },

  getDaysRemaining: (entry: TrashbinEntry): number => {
    const elapsedMs = Date.now() - entry.trashedAt;
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    return Math.max(1, RETENTION_DAYS - elapsedDays);
  },

  trashDate: (
    type: 'score' | 'attendance',
    date: string,
    recordIds: number[],
    tutorId?: number | string
  ): TrashbinEntry => {
    const dateKey = date.slice(0, 10);
    const entries = trashbinService.getEntries(type, tutorId);
    const newEntry: TrashbinEntry = {
      type,
      tutorId: tutorId || 'global',
      date: dateKey,
      recordIds,
      trashedAt: Date.now(),
    };
    entries[dateKey] = newEntry;
    try {
      localStorage.setItem(getStorageKey(type, tutorId), JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to save trashbin entry:', e);
    }
    return newEntry;
  },

  restoreDate: (type: 'score' | 'attendance', date: string, tutorId?: number | string): void => {
    const dateKey = date.slice(0, 10);
    const entries = trashbinService.getEntries(type, tutorId);
    if (entries[dateKey]) {
      delete entries[dateKey];
      try {
        localStorage.setItem(getStorageKey(type, tutorId), JSON.stringify(entries));
      } catch (e) {
        console.error('Failed to restore trashbin entry:', e);
      }
    }
  },

  checkAndPurgeExpired: async (
    type: 'score' | 'attendance',
    tutorId: number | string,
    onDeleteRecord: (id: number) => Promise<void>
  ): Promise<string[]> => {
    const entries = trashbinService.getEntries(type, tutorId);
    const purgedDates: string[] = [];
    const msPerDay = 1000 * 60 * 60 * 24;

    for (const [dateKey, entry] of Object.entries(entries)) {
      const elapsedDays = Math.floor((Date.now() - entry.trashedAt) / msPerDay);
      if (elapsedDays >= RETENTION_DAYS) {
        for (const id of entry.recordIds) {
          try {
            await onDeleteRecord(id);
          } catch (err) {
            console.error(`Failed to permanently purge record ${id}:`, err);
          }
        }
        delete entries[dateKey];
        purgedDates.push(dateKey);
      }
    }

    if (purgedDates.length > 0) {
      try {
        localStorage.setItem(getStorageKey(type, tutorId), JSON.stringify(entries));
      } catch (e) {
        console.error('Failed to save purged trashbin entries:', e);
      }
    }
    return purgedDates;
  },
};
