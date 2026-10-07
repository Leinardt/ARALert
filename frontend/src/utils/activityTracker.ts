/**
 * Activity & Inactivity (AFK) Tracking Utility
 * 
 * Tracks user interactions (mouse move, clicks, keyboard, touch, scroll)
 * and monitors AFK inactivity timeout (default: 30 minutes).
 */

const ACTIVITY_STORAGE_KEY = 'aralert_last_activity';
export const AFK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const THROTTLE_WRITE_MS = 3000; // Throttle localStorage writes to once every 3 seconds

let memoryLastActivity = Date.now();
let lastWriteTime = 0;

/**
 * Record a user interaction (mouse move, button click, keystroke, touch, etc.)
 */
export const recordActivity = (): void => {
  const now = Date.now();
  memoryLastActivity = now;

  if (now - lastWriteTime > THROTTLE_WRITE_MS) {
    lastWriteTime = now;
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
    } catch {
      // Storage quota or private mode fallback
    }
  }
};

/**
 * Get the latest timestamp of user activity across all tabs
 */
export const getLastActivityTime = (): number => {
  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    const storedTime = stored ? parseInt(stored, 10) : 0;
    return Math.max(memoryLastActivity, storedTime || 0);
  } catch {
    return memoryLastActivity;
  }
};

/**
 * Check if the user has been inactive / AFK for more than timeoutMs
 */
export const isUserAfk = (timeoutMs: number = AFK_TIMEOUT_MS): boolean => {
  const lastActive = getLastActivityTime();
  if (!lastActive) return false;
  return (Date.now() - lastActive) >= timeoutMs;
};

/**
 * Reset activity tracking (e.g. on fresh login)
 */
export const resetActivity = (): void => {
  const now = Date.now();
  memoryLastActivity = now;
  lastWriteTime = now;
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
  } catch {
    // ignore
  }
};

/**
 * Clear activity tracking on logout
 */
export const clearActivity = (): void => {
  memoryLastActivity = Date.now();
  lastWriteTime = 0;
  try {
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // ignore
  }
};

/**
 * Initialize event listeners and interval check for AFK detection
 */
export const initActivityTracker = (
  onAfkTimeout: () => void,
  timeoutMs: number = AFK_TIMEOUT_MS
): (() => void) => {
  const handleActivity = () => {
    // If the user was already AFK before this event fired, trigger timeout instead of recording activity
    if (isUserAfk(timeoutMs)) {
      onAfkTimeout();
      return;
    }
    recordActivity();
  };

  // Events that indicate user is actively using the system
  const eventTypes: Array<keyof WindowEventMap> = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'scroll',
    'click',
    'wheel',
  ];

  const handleStorage = (e: StorageEvent) => {
    if (e.key === ACTIVITY_STORAGE_KEY && e.newValue) {
      const parsed = parseInt(e.newValue, 10);
      if (!isNaN(parsed) && parsed > memoryLastActivity) {
        memoryLastActivity = parsed;
      }
    }
  };

  const handleVisibilityOrFocus = () => {
    if (!document.hidden) {
      if (isUserAfk(timeoutMs)) {
        onAfkTimeout();
      } else {
        recordActivity();
      }
    }
  };

  eventTypes.forEach((event) => {
    window.addEventListener(event, handleActivity, { passive: true });
  });

  window.addEventListener('storage', handleStorage);
  window.addEventListener('focus', handleVisibilityOrFocus);
  document.addEventListener('visibilitychange', handleVisibilityOrFocus);

  // Periodic AFK check every 5 seconds
  const intervalId = window.setInterval(() => {
    const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
    if (token && isUserAfk(timeoutMs)) {
      onAfkTimeout();
    }
  }, 5000);

  // Initial check on mount
  const currentToken = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
  if (currentToken && isUserAfk(timeoutMs)) {
    onAfkTimeout();
  } else {
    recordActivity();
  }

  // Teardown function
  return () => {
    eventTypes.forEach((event) => {
      window.removeEventListener(event, handleActivity);
    });
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('focus', handleVisibilityOrFocus);
    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    window.clearInterval(intervalId);
  };
};
