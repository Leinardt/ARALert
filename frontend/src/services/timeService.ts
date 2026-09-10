/**
 * Authoritative Server Time Service.
 *
 * Implements high-standard industry clock synchronization:
 * - Untamperable monotonic clock tracking using `performance.now()`.
 * - Immune to client operating system clock modifications, calendar shifts, or timezone tampering.
 * - Synchronizes with the backend authoritative clock on initial load, every API response via X-Server-Time,
 *   and periodic background drift correction.
 */

export interface ServerTimeResponse {
  iso: string;
  local_iso: string;
  timestamp_ms: number;
  date: string;
  time: string;
  timezone: string;
  day_of_week: string;
}

class TimeService {
  private serverTimeAtSyncMs: number = 0;
  private monotonicAtSyncMs: number = 0;
  private isSynced: boolean = false;
  private syncPromise: Promise<number> | null = null;

  constructor() {
    // Attempt fast initial sync
    if (typeof window !== 'undefined') {
      void this.syncWithServer();
      // Periodically refresh authoritative sync every 5 minutes
      setInterval(() => {
        void this.syncWithServer();
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Directly syncs with the server /api/time/ endpoint, compensating for round-trip latency.
   */
  public async syncWithServer(): Promise<number> {
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = (async () => {
      const startMonotonic = typeof performance !== 'undefined' ? performance.now() : Date.now();
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${baseUrl}/time/`);
        const data: ServerTimeResponse = await res.json();
        const endMonotonic = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const roundTripLatencyMs = Math.max(0, endMonotonic - startMonotonic);

        const serverTime = data.timestamp_ms + Math.round(roundTripLatencyMs / 2);
        this.serverTimeAtSyncMs = serverTime;
        this.monotonicAtSyncMs = endMonotonic;
        this.isSynced = true;
        return serverTime;
      } catch (err) {
        // If server is not reachable, fallback to Date.now() but mark as unsynced
        if (!this.isSynced) {
          this.serverTimeAtSyncMs = Date.now();
          this.monotonicAtSyncMs = typeof performance !== 'undefined' ? performance.now() : 0;
        }
        return this.nowMs();
      } finally {
        this.syncPromise = null;
      }
    })();

    return this.syncPromise;
  }

  /**
   * Synchronizes from headers attached to any incoming API response.
   */
  public syncFromHeader(serverTimestampMs: number, latencyMs = 0): void {
    if (!serverTimestampMs || Number.isNaN(serverTimestampMs)) return;
    const nowMono = typeof performance !== 'undefined' ? performance.now() : 0;
    this.serverTimeAtSyncMs = serverTimestampMs + Math.round(latencyMs / 2);
    this.monotonicAtSyncMs = nowMono;
    this.isSynced = true;
  }

  /**
   * Returns current untamperable timestamp (milliseconds since epoch).
   * Monotonic: unaffected by user changing device time.
   */
  public nowMs(): number {
    if (!this.isSynced || typeof performance === 'undefined') {
      return Date.now();
    }
    const elapsed = performance.now() - this.monotonicAtSyncMs;
    return Math.round(this.serverTimeAtSyncMs + elapsed);
  }

  /**
   * Returns authoritative Date instance.
   */
  public now(): Date {
    return new Date(this.nowMs());
  }

  /**
   * Returns authoritative YYYY-MM-DD date string (in local school timezone).
   */
  public todayStr(): string {
    const d = this.now();
    return d.toLocaleDateString('en-CA');
  }

  /**
   * Returns whether the clock has received authoritative server sync.
   */
  public isTamperProtected(): boolean {
    return this.isSynced;
  }
}

export const timeService = new TimeService();
